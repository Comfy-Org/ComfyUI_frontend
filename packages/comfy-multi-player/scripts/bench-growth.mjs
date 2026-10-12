/**
 * Growth matrix bench (risk 3, unbounded doc growth): bytes per op, per root,
 * per op shape. Prints slopes plus the raw checkpoint table.
 *
 *   npm run build && node scripts/bench-growth.mjs [ops=200] [checkpoints=5]
 *
 * Columns: total = encodeStateAsUpdate bytes; liveAll = same content
 * re-encoded fresh; history = total - liveAll (tombstones / GC shells);
 * live:<root> = fresh re-encode holding only that root.
 */

import * as Y from "yjs";
import { mint, applyOps } from "../dist/index.js";
import { runGrowthMatrix, formatMatrix } from "./growth-matrix.mjs";

const opCount = Number(process.argv[2] ?? 200);
const checkpoints = Number(process.argv[3] ?? 5);

const results = runGrowthMatrix(
  { Y, mint, applyOps },
  { opCount, checkpoints },
);

console.log(`growth matrix (${opCount} ops, ${checkpoints} checkpoints)\n`);
console.log(formatMatrix(results));
console.log("\ncheckpoints (bytes):");
for (const r of Object.values(results)) {
  console.log(`\n${r.name}`);
  for (const s of r.samples) {
    const live = Object.entries(s.live)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    console.log(
      `  ops=${s.ops} total=${s.total} liveAll=${s.liveAll} history=${s.history} ${live}`,
    );
  }
}
