# Op-layer portability contract

The TypeScript package is the reference implementation of semantic-op-to-Yjs-document behavior. `yjs` must remain its only production dependency root, and the built package must import in bare Node without reading or creating DOM globals. `npm run check:purity` enforces those KA-3 and FC-3 boundaries at the package level, and `npm run check:imports` enforces them per source module at the module-graph level.

## Golden-vector parity

`fixtures/golden-vectors/conformance.json` is the canonical, language-agnostic conformance manifest. Every implementation in another language, including a future Go doc-host applier, **must pass the same vectors** before it can be considered behaviorally compatible. `test/parity.test.ts` runs the TypeScript reference against them.

The manifest has a numeric `format_version`, a relative `catalog` path, ordered successful `cases`, a `result_cases` path for rejection/retry parity, and a `wire_layout` path for the Y.Doc wire layout. All paths are manifest-relative. Each successful case names a relative session JSONL file. A session's first line is a JSON header containing `base_workflow` and the recorded `workflow_final`; each remaining line is one stamped semantic op in application order. A conforming runner must:

1. initialize from `base_workflow` using the referenced catalog;
2. apply every op in file order with no failures or skips;
3. project the resulting document; and
4. deep-compare it with `workflow_final` after sorting nodes and links by stringified ID and subgraphs by stringified ID, as specified by schema §7.

For `result_cases`, a conforming runner must apply each case's ordered `batches` to one document and match the ordered `ApplyResult.outcomes` and `ops_seen`. Rejected outcomes compare `op_id` and `reason.code`; implementation-specific message text is not contractual. It must also compare the encoded document immediately before and after each batch when `document_unchanged` is true. This pins malformed, deferred, and unknown rejection, abort-remainder, same-`op_id` retries, and cross-batch retry behavior for KA-3, KA-4, and FC-7.

For `wire_layout`, a conforming runner must resolve the doc's root types by the names in `roots` and the reserved per-node keys in `reserved_node_keys`, reading them out of an encoded bootstrap snapshot rather than transcribing them, and must refuse a document whose `schema_version` disagrees with the vector's. The vector records NAMES only; the root TYPE of each (all `Y.Map` at `SCHEMA_VERSION = 2`) and the value shapes under them are in schema §1, which a port still has to read. `test/wire-layout-contract.test.ts` is the TypeScript reference's own conformance to it.

**Not vectored, but normative:** the schema §10 read gate is a conformance obligation the manifest cannot express. The vectors are all `applyOps` cases, so a runner in another language can pass 100% of them while accepting a document with no readable `meta.schema_version` as current — precisely the fail-open KA-11 forbids. Until a schema-version rejection vector exists, a conforming reader must implement it from the prose: an unreadable or disagreeing `meta.schema_version` is rejected, and both the rejection and the current-version no-op leave the encoded document unchanged.

**The gate is now on TWO entrypoints, and the projection one is the load-bearing half (Amendment A5).** A3 refined `migrate()`, but nothing forces a caller through `migrate()` — so a port that implemented A3 faithfully and stopped there is still fail-open in the way that matters, because `project()` is what every consumer actually calls. A conforming reader must refuse an unreadable or non-current `meta.schema_version` **on the projection path**, before it reads any workflow content, and that refusal must leave the encoded document unchanged AND materialize no root type. The same sentence as `portability.md`'s standing warning applies here: a port could pass 100% of the golden vectors and still be fail-open on read.

**Also not vectored, but normative:** how a runner counts *instances* of a subgraph definition for schema §5.3's "reject an interior write whose head definition is shared by more than one instance". An instance is a node whose `type` **resolves** to the definition, not a node whose `type` string equals the definition id. Four conditions, and the last two are the ones a re-implementation will get wrong:

1. the definition's own map key always counts;
2. its cosmetic `name` counts as an alias only as a legacy fallback, and an id always wins over a name;
3. a name owned by two definitions resolves to nothing, so nodes typed with it are not instances of either; and
4. **a name the pinned catalogue describes as a node CLASS is not an alias at all.** Display names are user-chosen and unvalidated, and naming a subgraph after the node it wraps is the obvious convention: three shipped template workflows name a definition `WanMoveTrackToVideo`, a real backend class instantiated inside that very definition. A runner that skips this condition rejects legal interior writes on real workflows. A runner with no catalogue in hand must not treat the name as an alias, because it cannot evaluate the condition.

Every conformance session in `fixtures/golden-vectors/` has single-instance definitions addressed by id, so a runner can count by literal string, pass 100% of the vectors, and still let one op mutate a definition backing two nodes — the KA-1 fan-out this package fixed in `countDefinitionInstances`. It can equally over-reject by taking rules 1-3 without rule 4, and no vector will say so. Until a shared-definition vector exists, implement all four from this prose.

The files use UTF-8 JSON/JSONL, JSON numbers, strings, booleans, arrays, objects, and null only. Runners must not rely on JavaScript-specific serialization or object-key order. Adding or changing op semantics requires updating the shared vectors and all language runners together; a second private fixture set is not an acceptable parity claim.
