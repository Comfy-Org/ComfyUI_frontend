# Op-layer portability contract

The TypeScript package is the reference implementation of semantic-op-to-Yjs-document behavior. `yjs` must remain its only production dependency root, and the built package must import in bare Node without reading or creating DOM globals. `npm run check:purity` enforces those KA-3 and FC-3 boundaries at the package level, and `npm run check:imports` enforces them per source module at the module-graph level.

## Golden-vector parity

`fixtures/golden-vectors/conformance.json` is the canonical, language-agnostic conformance manifest. Every implementation in another language, including a future Go doc-host applier, **must pass the same vectors** before it can be considered behaviorally compatible. `test/parity.test.ts` runs the TypeScript reference against them.

The manifest has a numeric `format_version`, a relative `catalog` path, ordered successful `cases`, and a `result_cases` path for rejection/retry parity. Each successful case names a relative session JSONL file. A session's first line is a JSON header containing `base_workflow` and the recorded `workflow_final`; each remaining line is one stamped semantic op in application order. A conforming runner must:

1. initialize from `base_workflow` using the referenced catalog;
2. apply every op in file order with no failures or skips;
3. project the resulting document; and
4. deep-compare it with `workflow_final` after sorting nodes and links by stringified ID and subgraphs by stringified ID, as specified by schema §7.

For `result_cases`, a conforming runner must apply each case's ordered `batches` to one document and match every expected `ApplyResult` field (`applied`, `skipped`, normalized `failed`, `applied_count`, and `version`). `failed` is normalized to `index`, `code`, and `op_id` so implementation-specific message text is not contractual. It must also compare the encoded document immediately before and after each batch when `document_unchanged` is true. This pins malformed, deferred, and unknown rejection, abort-remainder, same-`op_id` retries, and cross-batch retry behavior for KA-3, KA-4, and FC-7.

The files use UTF-8 JSON/JSONL, JSON numbers, strings, booleans, arrays, objects, and null only. Runners must not rely on JavaScript-specific serialization or object-key order. Adding or changing op semantics requires updating the shared vectors and all language runners together; a second private fixture set is not an acceptable parity claim.
