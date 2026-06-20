import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Automatically load .env.local safely
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const email = process.env.CONFLUENCE_USER_EMAIL;
const apiToken = process.env.CONFLUENCE_API_TOKEN;
const domain = process.env.CONFLUENCE_DOMAIN;

if (!email || !apiToken || !domain) {
  console.error("Missing Jira credentials in environment variables.");
  process.exit(1);
}

const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
const jiraHeaders = {
  'Authorization': `Basic ${auth}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json'
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function getOpenBugs() {
  // Fetch up to 10 latest open issues for SUP project only
  const jql = 'project = SUP AND statusCategory != Done ORDER BY created DESC';
  const url = `https://${domain}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=10&fields=summary,status,description,created`;
  const res = await fetch(url, { headers: jiraHeaders });
  if (!res.ok) throw new Error(`Jira API Error: ${res.status}`);
  const data = await res.json();
  return data.issues || [];
}

async function getTransitions(issueKey) {
  const url = `https://${domain}/rest/api/3/issue/${issueKey}/transitions`;
  const res = await fetch(url, { headers: jiraHeaders });
  if (!res.ok) throw new Error(`Jira Transitions API Error: ${res.status}`);
  const data = await res.json();
  return data.transitions || [];
}

async function transitionIssue(issueKey, transitionId) {
  const url = `https://${domain}/rest/api/3/issue/${issueKey}/transitions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: jiraHeaders,
    body: JSON.stringify({ transition: { id: transitionId } })
  });
  if (!res.ok) throw new Error(`Failed to transition issue ${issueKey}`);
}

async function addComment(issueKey, commentText) {
  const url = `https://${domain}/rest/api/3/issue/${issueKey}/comment`;
  const body = {
    body: {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: commentText }
          ]
        }
      ]
    },
    properties: [
      {
        key: "sd.public.comment",
        value: { internal: true }
      }
    ]
  };
  
  const res = await fetch(url, {
    method: 'POST',
    headers: jiraHeaders,
    body: JSON.stringify(body)
  });
  
  if (!res.ok) {
     console.error(`Failed to add comment to ${issueKey}. Status: ${res.status}`);
     const errorText = await res.text();
     console.error(`Error: ${errorText}`);
  }
}

async function triageBugs() {
  console.log("Fetching open issues from Jira...");
  const issues = await getOpenBugs();
  
  if (issues.length === 0) {
      console.log("No open issues found.");
      return;
  }
  
  console.log(`Found ${issues.length} open issues.\n`);

  for (const issue of issues) {
    const key = issue.key;
    const summary = issue.fields?.summary || 'No Summary';
    const status = issue.fields?.status?.name || 'Unknown';
    let description = '';
    
    // Attempt to extract text from ADF
    if (issue.fields?.description) {
       try {
           const descObj = typeof issue.fields.description === 'string' ? JSON.parse(issue.fields.description) : issue.fields.description;
           if (descObj.content) {
               description = descObj.content.map(c => {
                   if (!c.content) return '';
                   return c.content.map(t => t.text).join(' ');
               }).join('\n');
           } else {
               description = JSON.stringify(descObj);
           }
       } catch (e) {
           description = String(issue.fields.description);
       }
    }

    console.log(`----------------------------------------`);
    console.log(`Analyzing [${key}] - ${summary}`);
    
    try {
        const fallbackModels = [
            "gemini-3.5-flash",
            "gemini-2.5-flash",
            "gemini-flash-latest"
        ];
        
        let text = null;
        let lastError = null;

        for (const modelName of fallbackModels) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const prompt = `You are an expert software triage agent for a grass-roots sports management app called "Fees Please".
Review this bug report and decide if it needs to be investigated by a developer or closed (e.g. invalid, lacks detail, user error, duplicate, or test data).
If it is clearly a real bug or user issue that needs technical review, choose INVESTIGATE.
If it is a test ticket, junk data, or un-actionable, choose CLOSE.

Ticket Summary: ${summary}
Description: ${description}

OUTPUT FORMAT: You MUST return ONLY valid JSON in the following format, with no markdown formatting or backticks:
{"recommendation": "INVESTIGATE" or "CLOSE", "reasoning": "A concise 1-2 sentence explanation for the recommendation."}`;

                const result = await model.generateContent(prompt);
                text = result.response.text();
                break; // success
            } catch (e) {
                lastError = e;
            }
        }

        if (!text) throw new Error(`All models failed. Last error: ${lastError?.message}`);

        // Strip markdown backticks if the model ignores the instruction
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const object = JSON.parse(cleanText);

        console.log(`Recommendation: ${object.recommendation}`);
        console.log(`Reasoning: ${object.reasoning}`);

        // Add internal comment
        const commentText = `🤖 AI Triage Assessment:\nRecommendation: ${object.recommendation}\nReasoning: ${object.reasoning}`;
        await addComment(key, commentText);
        console.log(`Added internal comment to ${key}.`);

        if (object.recommendation === "CLOSE") {
            const transitions = await getTransitions(key);
            // Look for transition names that imply closing or discarding
            const closeTransition = transitions.find(t => 
                ['close', 'closed', 'done', 'resolved', 'decline', 'declined', 'cancel', 'cancelled'].includes(t.name.toLowerCase())
            );
            
            if (closeTransition) {
                await transitionIssue(key, closeTransition.id);
                console.log(`Transitioned ${key} to ${closeTransition.name}.`);
            } else {
                console.log(`Could not find a 'Close' transition for ${key}. Available transitions: ${transitions.map(t=>t.name).join(', ')}`);
            }
        }
    } catch (err) {
        console.error(`Error processing ${key}:`, err.message);
    }
  }
  console.log(`\n========================================`);
  console.log(`Triage complete!`);
}

triageBugs();
