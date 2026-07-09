// Run manually (node scripts/update-version.js, or double-click update-version.bat) whenever
// you want the corner version tag to match your latest commit title. NOT a git hook — it
// doesn't run automatically on commit/push/sync, so it can't interfere with your git workflow.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const title = execSync('git log -1 --pretty=%s', { cwd: path.join(__dirname, '..') }).toString().trim();
const file = path.join(__dirname, '..', 'src', 'core', 'display-version.js');

fs.writeFileSync(file,
    "// Version tag shown in the game's corner — update by running scripts/update-version.js\n" +
    "// (or update-version.bat) whenever you want it to match your latest commit title.\n" +
    "// Purely cosmetic — unrelated to GAME_VERSION in config.js, which drives save-data resets.\n" +
    'const DISPLAY_VERSION = ' + JSON.stringify(title) + ';\n'
);

console.log('display-version.js updated to: ' + title);
