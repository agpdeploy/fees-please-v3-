const playHqUrl = "https://www.playhq.com/cricket-australia/org/ferny-districts-cricket-club/462e4428/senior-competition-winter-2026/teams/ferny-districts-sunday-c-grade/b7cf852d";
const jinaUrl = `https://r.jina.ai/${playHqUrl}`;

async function run() {
  try {
    console.log("Fetching via Jina Reader:", jinaUrl);
    const res = await fetch(jinaUrl, {
      headers: {
        "Accept": "text/plain"
      }
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Text length:", text.length);
    console.log("Sample text (first 2000 chars):\n", text.substring(0, 2000));
    console.log("\nSample text (last 2000 chars):\n", text.substring(text.length - 2000));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

run();
