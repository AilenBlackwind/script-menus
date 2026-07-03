const fs = require("fs");
const path = require("path");
const files = ["main.js", "styles.css", "manifest.json"];
const dest = path.resolve(__dirname, "..", "..", "..", "..", "MainVault", ".obsidian", "plugins", "script-menus");
fs.mkdirSync(dest, { recursive: true });
for (const f of files) {
  fs.copyFileSync(path.join(__dirname, f), path.join(dest, f));
  console.log("Copied " + f);
}
