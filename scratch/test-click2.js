const https = require('https');

const data = JSON.stringify({
  team_id: '6e1400f6-b390-4297-bcd5-d3328529f775',
  sponsor_id: '36646a92-90bb-417e-835b-b701411473a4',
  event_type: 'click',
  source: 'hub'
});

const options = {
  hostname: 'app.feesplease.app',
  port: 443,
  path: '/api/track-sponsor',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, res => {
  console.log(`statusCode: ${res.statusCode}`);
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
