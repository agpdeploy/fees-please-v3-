const url = "https://www.playhq.com/cricket-australia/org/ferny-districts-cricket-club/462e4428/senior-competition-winter-2026/teams/ferny-districts-sunday-c-grade/b7cf852d";

async function run() {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_voiced_ostg.html)"
      }
    });
    console.log("Status:", res.status);
    const html = await res.text();
    console.log("HTML length:", html.length);
    // Find all meta tags
    const metas = html.match(/<meta[^>]*>/gi) || [];
    console.log("Meta tags found:", metas.length);
    metas.forEach(m => console.log(m));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

run();
