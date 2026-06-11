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
    
    // Find references to "x-phq-tenant" in the code
    const index = jsText.indexOf("x-phq-tenant");
    console.log("Index of x-phq-tenant:", index);
    if (index !== -1) {
      console.log("Snippet around x-phq-tenant:\n", jsText.substring(index - 200, index + 200));
    }
  } catch (err) {
    console.error(err);
  }
}

run();
