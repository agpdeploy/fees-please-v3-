const { Resend } = require('resend');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
let resendApiKey = '';
env.split('\n').forEach(line => {
  if (line.startsWith('RESEND_API_KEY=')) resendApiKey = line.split('=')[1].trim().replace(/['"]/g, '');
});

const resend = new Resend(resendApiKey);

async function run() {
  const emailPayloads = [{
    from: "Fees Please <reminders@mail.feesplease.app>",
    to: "cervo07@gmail.com",
    subject: "Test email",
    html: "Test email"
  }];

  console.log("Sending...");
  const { data, error } = await resend.batch.send(emailPayloads);
  console.log("Error:", error);
  console.log("Data:", data);
}
run();
