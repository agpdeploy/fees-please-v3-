import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { marked } from 'marked';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const domain = process.env.CONFLUENCE_DOMAIN;
const email = process.env.CONFLUENCE_USER_EMAIL;
const token = process.env.CONFLUENCE_API_TOKEN;
const spaceKey = process.env.CONFLUENCE_SPACE_KEY || 'FP';

if (!domain || !email || !token) {
  console.error("❌ Error: Missing Confluence configuration in .env.local.");
  console.error("Please ensure CONFLUENCE_DOMAIN, CONFLUENCE_USER_EMAIL, and CONFLUENCE_API_TOKEN are set.");
  process.exit(1);
}

const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;

// Helper: Parse YAML-like frontmatter
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  if (!match) {
    return { metadata: {}, body: content };
  }
  const yamlContent = match[1];
  const body = match[2];
  const metadata = {};
  yamlContent.split('\n').forEach(line => {
    const parts = line.split(':');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join(':').trim().replace(/^['"]|['"]$/g, '');
      metadata[key] = val;
    }
  });
  return { metadata, body };
}

// Confluence API: Fetch page ID and version by title
async function fetchPageInfoByTitle(title) {
  const url = `https://${domain}/wiki/rest/api/content?spaceKey=${spaceKey}&title=${encodeURIComponent(title)}&expand=version`;
  const res = await fetch(url, {
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch page info: ${res.statusText}`);
  }
  const data = await res.json();
  if (data && data.results && data.results.length > 0) {
    return {
      id: data.results[0].id,
      version: data.results[0].version.number
    };
  }
  return null;
}

// Confluence API: Create new page
async function createPage(title, htmlContent, parentId) {
  const url = `https://${domain}/wiki/rest/api/content`;
  const body = {
    type: "page",
    title: title,
    space: { key: spaceKey },
    body: {
      storage: {
        value: htmlContent,
        representation: "storage"
      }
    }
  };
  if (parentId) {
    body.ancestors = [{ id: parentId }];
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Create page failed: ${res.status} - ${errText}`);
  }
  const data = await res.json();
  return data.id;
}

// Confluence API: Update existing page
async function updatePage(pageId, title, htmlContent, nextVersion, parentId) {
  const url = `https://${domain}/wiki/rest/api/content/${pageId}`;
  const body = {
    id: pageId,
    type: "page",
    title: title,
    space: { key: spaceKey },
    body: {
      storage: {
        value: htmlContent,
        representation: "storage"
      }
    },
    version: {
      number: nextVersion
    }
  };
  if (parentId) {
    body.ancestors = [{ id: parentId }];
  }
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Update page failed: ${res.status} - ${errText}`);
  }
  const data = await res.json();
  return data.id;
}

async function main() {
  console.log(`Starting Confluence documentation sync for space: "${spaceKey}"...`);

  // Target parent page titles in Confluence
  const parents = {
    "User Documentation": null,
    "Release Notes": null
  };

  // Find parent page IDs dynamically by title
  for (const parentTitle of Object.keys(parents)) {
    try {
      const pageInfo = await fetchPageInfoByTitle(parentTitle);
      if (pageInfo) {
        parents[parentTitle] = pageInfo.id;
        console.log(`✅ Found parent page ID for "${parentTitle}": ${pageInfo.id}`);
      } else {
        console.warn(`⚠️ Warning: Parent page "${parentTitle}" not found in space "${spaceKey}". Pages will be created at root level.`);
      }
    } catch (err) {
      console.error(`❌ Error searching for parent page "${parentTitle}":`, err.message);
    }
  }

  const docDirectories = [
    { dir: 'docs/features', parentTitle: 'User Documentation' },
    { dir: 'docs/releases', parentTitle: 'Release Notes' }
  ];

  for (const config of docDirectories) {
    const dirPath = path.resolve(config.dir);
    if (!fs.existsSync(dirPath)) {
      console.log(`Skipping directory ${config.dir} (does not exist)`);
      continue;
    }

    const files = fs.readdirSync(dirPath).filter(file => file.endsWith('.md'));
    console.log(`Processing directory: ${config.dir} (${files.length} files found)`);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const { metadata, body } = parseFrontmatter(content);

      const title = metadata.title || path.basename(file, '.md');
      const htmlBody = await marked.parse(body);

      const parentTitle = metadata.parent || config.parentTitle;
      const parentId = parents[parentTitle] || null;

      try {
        console.log(`Syncing page: "${title}"...`);
        const existingPage = await fetchPageInfoByTitle(title);

        if (existingPage) {
          console.log(`  🔄 Page exists (ID: ${existingPage.id}, Version: ${existingPage.version}). Updating to version ${existingPage.version + 1}...`);
          await updatePage(existingPage.id, title, htmlBody, existingPage.version + 1, parentId);
          console.log(`  🎉 Page "${title}" updated successfully.`);
        } else {
          console.log(`  ➕ Page does not exist. Creating new page under "${parentTitle}"...`);
          const newId = await createPage(title, htmlBody, parentId);
          console.log(`  🎉 Page "${title}" created successfully (ID: ${newId}).`);
        }
      } catch (err) {
        console.error(`  ❌ Failed to sync page "${title}":`, err.message);
      }
    }
  }
}

main().catch(err => {
  console.error("❌ Sync script crashed:", err);
  process.exit(1);
});
