# Purity and portability review

Apply this profile to changes to `src/**`, exports, package metadata, build configuration, and dependencies. It protects KA-3 and FC-3.

- Positively verify that `yjs` is the only declared and resolved production dependency root. `scripts/check-purity.mjs` walks `npm ls --omit=dev --json --all`; a denylist alone is insufficient.
- Reject DOM globals, UI frameworks, LiteGraph, browser-only APIs, server-only APIs, credentials, filesystem, network, and process-specific state in applier, projection, or mint paths.
- Verify the built public entrypoint imports in bare Node without creating globals and remains browser-compatible.
- Treat any second op-to-document implementation, including one in Go, as a blocking FC-3 violation. Browser and Node doc host must consume this package.
- Require `npm run build`, `npm run check:purity`, and `npm test`.
