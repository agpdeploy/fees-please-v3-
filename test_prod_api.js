const https = require('https');
const data = JSON.stringify({
  fixtureId: "some-id",
  teamId: "6e1400f6-b390-4297-bcd5-d3328529f775",
  action: "send",
  senderName: "Ashley",
  selectedPlayerIds: ["dd520943-b936-4232-86fe-9083fc5cc5fd"]
});
const options = {
  hostname: 'feesplease.app',
  port: 443,
  path: '/api/send-reminders',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};
const req = https.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log("Response:", body));
});
req.write(data);
req.end();
