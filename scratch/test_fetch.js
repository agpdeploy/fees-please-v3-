const url = "https://www.playhq.com/cricket-australia/org/cricket-australia-state-competitions/summer-202526/fixtures-and-ladders";

async function run() {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    console.log("Status:", res.status);
    const html = await res.text();
    console.log("HTML length:", html.length);
    console.log("Sample HTML:", html.substring(0, 1000));
    // Let's check if the HTML has any keyword like "next-data" or if it is server-rendered or has JSON embedded
    console.log("Contains next-data:", html.includes("__NEXT_DATA__"));
    console.log("Contains fixtures:", html.toLowerCase().includes("fixture"));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

run();
