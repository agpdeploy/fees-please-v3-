const fs = require('fs');
const path = require('path');

const replacements = [
  { from: /Club Admin/g, to: 'Account Admin' },
  { from: /club admin/g, to: 'account admin' },
  { from: /Club configuration/gi, to: 'Account Configuration' },
  { from: /Club Configuration/g, to: 'Account Configuration' },
  { from: /Club Settings/g, to: 'Account Settings' },
  { from: /Club Name/g, to: 'Account Name' },
  { from: /Delete Club/g, to: 'Delete Account' },
  { from: /Active Club/g, to: 'Active Account' },
  { from: /Deactivate Club/g, to: 'Deactivate Account' },
  { from: /Reactivate Club/g, to: 'Reactivate Account' },
  { from: /Create Club/g, to: 'Create Account' },
  { from: /Club Level/g, to: 'Account Level' },
  { from: /Club Wallet/g, to: 'Account Wallet' },
  { from: /Club Logo/g, to: 'Account Logo' },
  { from: /Club Email/g, to: 'Account Email' },
  { from: /Club Profile/g, to: 'Account Profile' },
  { from: /Switch Club/g, to: 'Switch Account' },
  { from: /Select Club/g, to: 'Select Account' },
  { from: /New Club/g, to: 'New Account' },
  { from: /Your Club/g, to: 'Your Account' },
  { from: /Club details/gi, to: 'Account details' },
  { from: /Club Details/g, to: 'Account Details' },
  { from: /belong to a club/gi, to: 'belong to an account' }
];

function processDirectory(directory) {
  fs.readdirSync(directory).forEach(file => {
    const fullPath = path.join(directory, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      replacements.forEach(r => {
        if (r.from.test(content)) {
          content = content.replace(r.from, r.to);
          changed = true;
        }
      });
      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  });
}

processDirectory('./components');
processDirectory('./app');
