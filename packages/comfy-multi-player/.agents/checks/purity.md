# Purity and portability review

Apply this profile to changes to `src/**`, exports, package metadata, build configuration, and dependencies. It protects KA-3 and FC-3.

- Positively verify that `yjs` is the only declared and resolved production dependency root. `scripts/check-purity.mjs` walks `npm ls --omit=dev --json --all`; a denylist alone is insufficient.
- Reject DOM globals, UI frameworks, LiteGraph, browser-only APIs, server-only APIs, credentials, filesystem, network, and process-specific state in applier, projection, or mint paths.
- Verify the built public entrypoint imports in bare Node without creating globals and remains browser-compatible.
- Treat any second op-to-document implementation, including one in Go, as a blocking FC-3 violation. Browser and Node doc host must consume this package.
- Require `npm run build`, `npm run check:purity`, `npm run check:imports`, and `npm test`. `check:purity` reasons about the installed dependency tree and a bare-Node import of `dist/`; `check:imports` covers the same contract at the module-graph level, which is where a per-file DOM or server-only import is visible.
- Read `check:purity`'s exit code, not only its output: `0` pure, `1` violation, `2` preconditions missing (no `dist/`, no `node_modules`). Exit `2` is INCONCLUSIVE — run `npm ci && npm run build` and retry; never record it as a pass.

<!-- Staleness anchors for the exit codes and the gate list this profile restates. -->
<!-- claim: runtime dependency roots exactly {yjs} (declared and resolved production graph) :: scripts/check-purity.mjs -->
<!-- claim: dist/index.js not found — run `npm run build` before check:purity :: scripts/check-purity.mjs -->
<!-- claim: "check:imports": "node scripts/check-import-graph.mjs" :: package.json -->
<!-- claim: "check:purity": "node scripts/check-purity.mjs" :: package.json -->
