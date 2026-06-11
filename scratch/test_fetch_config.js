const url = "https://www.playhq.com/config.js";

async function run() {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Config text length:", text.length);
    console.log("Config text sample:\n", text);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

run();
