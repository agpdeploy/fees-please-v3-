const fs = require('fs');

const now = new Date();
const formatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Brisbane',
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const parts = formatter.formatToParts(now);
const p = {};
parts.forEach(({ type, value }) => {
  p[type] = value;
});

const version = `0.1:${p.year}${p.month}${p.day}:${p.hour}:${p.minute}`;

fs.writeFileSync('lib/version.ts', `export const APP_VERSION = "${version}";\n`);
