const fs = require('fs');
const path = require('path');

const DIRS_TO_SEARCH = ['app', 'components', 'lib'];
const PATTERNS = [/gemini-/i, /GoogleGenerativeAI/i, /generateText/i, /@ai-sdk/i];

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        for (const pattern of PATTERNS) {
          if (pattern.test(lines[i])) {
            console.log(`${fullPath}:${i + 1}: ${lines[i].trim()}`);
            break;
          }
        }
      }
    }
  }
}

DIRS_TO_SEARCH.forEach(searchDir);
