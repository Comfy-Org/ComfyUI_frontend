# V1-007 spike artifacts — REFERENCE ONLY, NOT SHIPPED CODE

Graduated verbatim from the CRDT schema-validation spike. Nothing in this
directory is built, tested, imported, or published (`files` in package.json
ships `dist/` only; tsconfig compiles `src/` only).

- `SPIKE-REPORT.md` — the verdicts: replay/idempotency/convergence/LWW/bounded-
  writes results, the widgets-as-Y.Array danger zone, and the design
  constraints that became decisions in `docs/multiplayer-schema.md`.
- `applier.mjs` — the prototype Yjs applier the spike verified. It is the
  **first draft** for the real applier ticket, with two known deliberate gaps
  (definitions stored as a meta blob; `inputcount`-family grow unimplemented)
  and one schema decision it predates (widgets are positional here; the
  shipped schema uses a name-keyed map — `docs/multiplayer-schema.md` §1.2).

When the real applier lands in `src/`, keep this copy frozen — it documents
what the spike actually measured.
