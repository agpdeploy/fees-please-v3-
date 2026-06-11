const fs = require('fs');
const path = require('path');

const bundlePath = 'C:/Users/ashle/.gemini/antigravity/brain/4401e6eb-b8a3-4e33-a93d-6d105fa3cb85/scratch/playhq.js';
if (!fs.existsSync(bundlePath)) {
  console.log('Bundle not found at', bundlePath);
  process.exit(1);
}

const content = fs.readFileSync(bundlePath, 'utf8');

// Find occurrences of "query " or "discoverTeamFixture"
const regex = /query\s+[a-zA-Z0-9_]+/g;
const matches = content.match(regex) || [];
console.log('Total query matches found:', matches.length);
console.log('Unique query names:', [...new Set(matches)]);

// Let's search specifically for queries related to Organisation or Competitions
const orgRegex = /query\s+([a-zA-Z0-9_]*[Oo]rganisation[a-zA-Z0-9_]*)/g;
const orgMatches = content.match(orgRegex) || [];
console.log('Organisation-related queries:', [...new Set(orgMatches)]);

const compRegex = /query\s+([a-zA-Z0-9_]*[Cc]ompetition[a-zA-Z0-9_]*)/g;
const compMatches = content.match(compRegex) || [];
console.log('Competition-related queries:', [...new Set(compMatches)]);

// Let's print snippets around any "discoverOrganisation" or "organisation" or similar queries
const searchTerms = ['discoverTeamFixture', 'discoverOrganisation', 'Organisation', 'discoverCompetitions'];
searchTerms.forEach(term => {
  let idx = 0;
  while ((idx = content.indexOf(term, idx)) !== -1) {
    console.log(`\n--- Match for "${term}" at index ${idx} ---`);
    console.log(content.substring(idx - 200, idx + 800));
    idx += term.length;
    // Just show first 2 matches per term to keep output clean
    if (term === 'Organisation' && idx > 500000) break; 
  }
});
