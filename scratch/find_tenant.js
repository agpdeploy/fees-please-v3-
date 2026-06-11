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
    
    // Find all occurrences of headers keys
    // Let's search for "x-phq"
    const xphqIndex = jsText.indexOf("x-phq");
    console.log("Index of x-phq:", xphqIndex);
    if (xphqIndex !== -1) {
      console.log("Snippet around x-phq:\n", jsText.substring(xphqIndex - 200, xphqIndex + 200));
    }
    
    // Let's search for "tenant" in headers config
    const tenantIndices = [];
    let idx = jsText.indexOf("tenant");
    while (idx !== -1) {
      tenantIndices.push(idx);
      idx = jsText.indexOf("tenant", idx + 1);
    }
    console.log("Found tenant keyword:", tenantIndices.length, "times");
    
    // Print snippet for first 5 occurrences
    tenantIndices.slice(0, 5).forEach((val, i) => {
      console.log(`\nOccurrence ${i} (index ${val}):\n`, jsText.substring(val - 100, val + 100));
    });
    
  } catch (err) {
    console.error(err);
  }
}

run();
