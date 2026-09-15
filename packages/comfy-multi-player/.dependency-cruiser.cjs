/**
 * dependency-cruiser configuration for @comfyorg/comfy-multi-player.
 *
 * Backs the `.agents/checks/import-graph.md` reviewer profile and
 * `npm run check:imports`. It expresses the purity contract
 * (docs/INVARIANTS.md KA-3 / FC-3) at the MODULE-GRAPH level, which is the
 * layer `scripts/check-purity.mjs` cannot see: that gate reasons about the
 * installed dependency tree and a bare-Node import of `dist/`, so it cannot
 * tell which source module reached for what.
 *
 * CommonJS (`.cjs`) on purpose: the package is `"type": "module"`, so a
 * `.dependency-cruiser.js` using `module.exports` would fail to load.
 *
 * `tsPreCompilationDeps: true` keeps type-only imports (`import type { … }`)
 * in the graph. A type-only import of a DOM or server-only module is still a
 * purity violation worth catching, and it does not change emitted output.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment:
        "Circular imports among the pure op modules make the package harder to tree-shake and reason about, and they hide initialization-order bugs. Extract the shared type or helper instead.",
      from: {},
      to: { circular: true },
    },
    {
      name: "src-runtime-dep-is-yjs-only",
      severity: "error",
      comment:
        "KA-3 / FC-3: the op layer runs identically in the browser and the Node doc host, so `yjs` is the only package `src/` may import. This is the yjs-only assertion at the MODULE-GRAPH level — per source module. `scripts/check-purity.mjs` already asserts it positively at the PACKAGE level (declared and resolved production roots exactly {yjs}); the two are complementary layers, not a gap and its fix. Issue #22 raised the package-level gap and is closed. Note this matches DIRECT edges out of `^src` only.",
      from: { path: "^src" },
      to: {
        dependencyTypes: ["npm", "npm-dev", "npm-optional", "npm-peer", "npm-bundled", "npm-no-pkg"],
        // `(^|/)`, not `^`: the resolved path is relative to the cwd, so under
        // pnpm (`node_modules/.pnpm/yjs@…/node_modules/yjs`), a workspace root,
        // or any symlinked tree it is not anchored at the start. Anchoring at
        // `^` turns every legitimate yjs import into a violation there — which
        // `test/check-import-graph.test.ts` reproduced against a symlinked
        // fixture tree. Still boundary-anchored at both ends, so
        // `node_modules/yjs-shim` is NOT exempted.
        pathNot: "(^|/)node_modules/yjs(/|$)",
      },
    },
    {
      name: "src-no-node-builtins",
      severity: "error",
      comment:
        "FC-3: a Node builtin (`node:fs`, `node:net`, …) in the op layer makes it server-only and unrunnable in a browser or at a peer.",
      from: { path: "^src" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "no-unresolvable",
      severity: "error",
      comment:
        "An import dependency-cruiser cannot resolve is either a typo or a module that only exists in one of the two runtimes.",
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    // NO `includeOnly: "^src"`. That filter drops every module outside `src`
    // from the graph — including `node_modules/**` and Node builtins — so the
    // purity rules above have nothing left to match and can never fire. It is
    // the same vacuous-green trap as scanning a `.ts` tree with `.ts` disabled:
    // the run is green because it looked at nothing. `doNotFollow` is the
    // correct tool: external modules stay in the graph as edges, their own
    // dependencies are simply not traversed.
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
    },
  },
};
