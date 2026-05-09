const fs = require("fs");
const en = JSON.parse(fs.readFileSync("src/locales/en/nodeDefs.json", "utf8"));
const zh = JSON.parse(fs.readFileSync("src/locales/zh/nodeDefs.json", "utf8"));

let count = 0;
const enKeys = Object.keys(en).filter(k => en[k].display_name);
console.log("=== Nodes with UNTRANSLATED display_name ===");
for (const k of enKeys) {
  const enName = en[k].display_name;
  const zhName = zh[k] ? zh[k].display_name : "";
  if (zhName === enName && enName.length > 2) {
    console.log("  " + k + ' = "' + enName + '"');
    count++;
    if (count >= 15) break;
  }
}

// Count total
let total = 0;
for (const k of enKeys) {
  if (zh[k] && zh[k].display_name === en[k].display_name && en[k].display_name.length > 2) {
    total++;
  }
}
console.log("\nTotal untranslated display_names: " + total + " / " + enKeys.length);
