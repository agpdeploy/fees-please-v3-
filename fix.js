const fs = require('fs');

let c = fs.readFileSync('components/Ledger.tsx', 'utf8');

// I replaced `{isInlineManualFormOpen ? (...) : ( <div...>` with `<div...>`.
// This left an extra `)}` at the end of the `isInlineManualFormOpen` block.
// The old structure was:
/*
                          {isInlineManualFormOpen ? (
                              <form...
                          ) : (
                              <div className="space-y-3">
                                ...
                              </div>
                          )}
                        </div>
*/
// Because I replaced the top part, it became:
/*
                          <div className="space-y-3">
                            ...
                          </div>
                          )}
                        </div>
*/
// So I just need to find `</div>\s*<button\s*onClick=\{async \(\) => \{\s*if \(\!confirm\(\`Are you sure you want to \$\{player\.is_active \? 'deactivate' : 'reactivate'\} this player\?\`\)\).*?<\/button>\s*<\/div>\s*\)\}\s*<\/div>\s*\)\}\s*<\/div>\s*\)\}\s*<\/div>\s*\)\}\s*<\/div>\s*\);\s*}\)\s*)\}/`
// Actually, I can just use a regex to look for that specific extra `)}`.

c = c.replace(/(\s*)\)\}(\s*<\/div>\s*\)\}\s*<\/div>\s*\)\}\s*<\/div>\s*\);\s*}\)\s*\)\})/, "$1$2");

fs.writeFileSync('components/Ledger.tsx', c);
console.log("Fixed!");
