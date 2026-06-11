const fetch = require('node-fetch');

async function run() {
  const url = 'https://www.playhq.com/cricket-australia/org/ferny-districts-cricket-club/462e4428/senior-competition-winter-2026/5eb3dc88/teams';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });
    
    if (!res.ok) {
      console.error("HTTP error:", res.status);
      return;
    }
    
    const html = await res.text();
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
    if (nextDataMatch && nextDataMatch[1]) {
      const nextData = JSON.parse(nextDataMatch[1]);
      // Let's print the first few keys to see where teams might be
      // usually it's in props.pageProps
      const pageProps = nextData.props.pageProps;
      console.log(JSON.stringify(pageProps, null, 2).substring(0, 500));
      // Try to find the teams array
      const initialData = pageProps.initialData; // Or something like that
    } else {
      console.log("No NEXT_DATA found.");
    }
  } catch(e) {
    console.error(e);
  }
}

run();
