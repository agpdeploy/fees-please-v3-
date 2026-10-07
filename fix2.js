const fs = require('fs');

let c = fs.readFileSync('components/Ledger.tsx', 'utf8');

c = c.replace(/(\s*)<\/div>\s*\)\}\s*<\/div>\s*\)\}\s*<\/div>\s*\)\}\s*<\/div>\s*\)\}\s*<\/div>\s*\);\s*}\)\s*\)\}/, 
`$1</div>
                          </div>
                      )}
                    </div>
                  );
                })
              )}`);

fs.writeFileSync('components/Ledger.tsx', c);
console.log("Fixed again!");
