const fs = require('fs');
const now = new Date();
const pad = (n) => n.toString().padStart(2, '0');
const version = `0.1-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
fs.writeFileSync('lib/version.ts', `export const APP_VERSION = "${version}";\n`);
