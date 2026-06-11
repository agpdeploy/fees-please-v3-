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
    
    // Search for headers config in indexJS
    // Let's search for "createHttpLink" or "ApolloLink" or "headers"
    const searchTerms = [
      "createHttpLink",
      "ApolloClient",
      "headers:",
      "x-",
      "tenant"
    ];
    
    for (const term of searchTerms) {
      const idx = jsText.indexOf(term);
      console.log(`Index of "${term}":`, idx);
      if (idx !== -1) {
        console.log(`Snippet around "${term}":\n`, jsText.substring(idx - 100, idx + 100));
      }
    }
  } catch (err) {
    console.error(err);
  }
}

run();
