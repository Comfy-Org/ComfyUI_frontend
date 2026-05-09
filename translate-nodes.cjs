const fs = require("fs");
const zh = JSON.parse(fs.readFileSync("src/locales/zh/nodeDefs.json", "utf8"));

// Translate descriptive/functional node names, not product names
const translations = {
  "EmptyARVideoLatent": "空AR视频Latent",
  "CropByBBoxes": "按边界框裁剪",
  "EasyCache": "简易缓存",
  "FreeU_V2": "FreeU V2",
  "CFGZeroStar": "CFGZeroStar",
  "FreSca": "FreSca",
  "FreeU": "FreeU",
  "ARVideoI2V": "ARVideoI2V",
};

let changed = 0;
for (const [key, value] of Object.entries(translations)) {
  if (zh[key]) {
    console.log(key + ': "' + zh[key].display_name + '" -> "' + value + '"');
    zh[key].display_name = value;
    changed++;
  }
}

// Write back
fs.writeFileSync("src/locales/zh/nodeDefs.json", JSON.stringify(zh, null, 2) + "\n", "utf8");
console.log("\nChanged " + changed + " nodes");
