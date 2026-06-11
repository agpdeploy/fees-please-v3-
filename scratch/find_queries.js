const rootUrl = "https://www.playhq.com/";

async function run() {
  try {
    const res = await fetch(rootUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const html = await res.text();
    const scriptMatch = html.match(/src="(\/assets\/index\.[a-z0-9]+\.js)"/);
    if (!scriptMatch) return;
    const jsUrl = new URL(scriptMatch[1], rootUrl).toString();
    const jsRes = await fetch(jsUrl);
    const jsText = await jsRes.text();
    
    // Find all queries starting with query or template strings
    // In minified code, templates are often structured as e.g. "query ... { ... }"
    // Let's search for matches of `query <name>`
    const queryRegex = /query\s+([A-Za-z0-9_]+)/g;
    const queries = [];
    let match;
    while ((match = queryRegex.exec(jsText)) !== null) {
      queries.push(match[1]);
    }
    console.log("Distinct Query Names:", [...new Set(queries)]);

    // Let's find specific queries containing "team" or "fixture"
    const interesting = [...new Set(queries)].filter(q => 
      q.toLowerCase().includes("team") || 
      q.toLowerCase().includes("fixture") || 
      q.toLowerCase().includes("org") || 
      q.toLowerCase().includes("club")
    );
    console.log("Interesting Query Names:", interesting);

    // Let's print the full query text for a few interesting ones
    // We can search for the start of the query to the closing bracket
    interesting.forEach(qName => {
      const index = jsText.indexOf("query " + qName);
      if (index !== -1) {
        // Grab 500 characters from the index
        console.log(`\n--- QUERY: ${qName} ---`);
        console.log(jsText.substring(index, index + 800));
      }
    });

  } catch (err) {
    console.error(err);
  }
}

run();
