const url = "https://www.playhq.com/cricket-australia/org/cricket-australia-state-competitions/summer-202526/fixtures-and-ladders";

async function run() {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
      }
    });
    console.log("Status:", res.status);
    const html = await res.text();
    console.log("HTML length:", html.length);
    console.log("Contains fixtures:", html.toLowerCase().includes("fixture"));
    console.log("Sample:", html.substring(0, 1000));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

run();
