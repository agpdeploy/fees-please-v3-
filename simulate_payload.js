const https = require('https');

const payload = {
  fixtureId: "some-fixture-id",
  teamId: "6e1400f6-b390-4297-bcd5-d3328529f775",
  action: "send",
  senderName: "Ashley",
  selectedPlayerIds: ["dd520943-b936-4232-86fe-9083fc5cc5fd"]
};

console.log("Payload to send:", payload);
