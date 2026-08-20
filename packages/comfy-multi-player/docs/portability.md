# Op-layer portability contract

The TypeScript package is the reference implementation of semantic-op-to-Yjs-document behavior. `yjs` must remain its only production dependency root, and the built package must import in bare Node without reading or creating DOM globals. `npm run check:purity` enforces those KA-3 and FC-3 boundaries.

## Golden-vector parity

`fixtures/golden-vectors/conformance.json` is the canonical, language-agnostic conformance manifest. Every implementation in another language, including a future Go doc-host applier, **must pass the same vectors** before it can be considered behaviorally compatible. `test/parity.test.ts` runs the TypeScript reference against them.

The manifest has a numeric `format_version`, a relative `catalog` path, and ordered `cases`. Each case names a relative session JSONL file. A session's first line is a JSON header containing `base_workflow` and the recorded `workflow_final`; each remaining line is one stamped semantic op in application order. A conforming runner must:

1. initialize from `base_workflow` using the referenced catalog;
2. apply every op in file order with no failures or skips;
3. project the resulting document; and
4. deep-compare it with `workflow_final` after sorting nodes and links by stringified ID and subgraphs by stringified ID, as specified by schema §7.

The files use UTF-8 JSON/JSONL, JSON numbers, strings, booleans, arrays, objects, and null only. Runners must not rely on JavaScript-specific serialization or object-key order. Adding or changing op semantics requires updating the shared vectors and all language runners together; a second private fixture set is not an acceptable parity claim.
