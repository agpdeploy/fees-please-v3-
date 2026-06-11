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
    
    // Find all query names containing player/squad/member/participant
    const queryRegex = /query\s+([A-Za-z0-9_]+)/g;
    const queries = [];
    let match;
    while ((match = queryRegex.exec(jsText)) !== null) {
      queries.push(match[1]);
    }
    
    const uniqueQueries = [...new Set(queries)];
    const keywords = ["squad", "player", "member", "participant", "roster"];
    const matched = uniqueQueries.filter(q => 
      keywords.some(k => q.toLowerCase().includes(k))
    );
    
    console.log("Matched queries:", matched);
    
    matched.forEach(qName => {
      const idx = jsText.indexOf("query " + qName);
      if (idx !== -1) {
        console.log(`\n--- QUERY: ${qName} ---`);
        console.log(jsText.substring(idx, idx + 800));
      }
    });
  } catch (err) {
    console.error(err);
  }
}

run();
