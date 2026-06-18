const fetch = require('node-fetch');
async function run() {
  const playhqUrl = 'https://www.playhq.com/cricket-australia/org/ferny-districts-cricket-club/462e4428/senior-competition-winter-2026/teams/ferny-districts-bin-chickens/b7cf852d';
  
  const res = await fetch('http://localhost:3000/api/playhq-sync', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: playhqUrl }),
  });
  const data = await res.json();
  console.log("Fixtures returned from API route:", data.fixtures ? data.fixtures.length : "undefined", data.error);
}
run();
