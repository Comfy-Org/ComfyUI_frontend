# Generated billing contracts

One file per endpoint contract the billing SDK core decodes. Each pins the
fields the core actually reads and the enum members it branches on, so a
regenerated `@comfyorg/ingest-types` that renames, drops, or widens one of them
fails here instead of surfacing as a runtime `MALFORMED_RESPONSE`.

Each file pins its contract twice, and the two halves fail in different jobs:

- `describe` blocks hold the runtime pins — what the generated schema accepts
  and rejects. `pnpm --filter @comfyorg/account-core test` fails on those.
- Module-scope `expectTypeOf` calls hold the type pins — the shapes the SDK
  reads off a parsed body. Vitest never evaluates them; the package
  `typecheck` script is what fails, as a `TS2344`. They sit outside `it` so
  the vitest report never counts a pass vitest did not check.

A failure means the backend contract moved: fix the SDK, not the test. Where
the SDK reads a field more leniently than the generated schema does, the test
name says so — that row pins the generated shape, not the SDK's.
