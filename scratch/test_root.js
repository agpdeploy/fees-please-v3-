const url = "https://www.playhq.com/";

async function run() {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const html = await res.text();
    console.log("Index HTML Sample:\n", html);
  } catch (err) {
    console.error("Failed:", err);
  }
}

run();
