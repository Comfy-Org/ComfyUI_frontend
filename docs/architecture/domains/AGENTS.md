# Domain architecture records

`records/*.domain.json` and `exceptions.json` are hand-edited.
`boundaries.json` is generated. README.md defines the rules.

When `pnpm architecture:check` fails, act on the message:

- `is a new architecture suppression`: remove the `eslint-disable` or
  `fallow-ignore` comment and fix the import. Only the domain owner may accept
  the debt by adding the fingerprint to one exception in `exceptions.json`.
- `which no longer exists`: delete the listed fingerprint from
  `exceptions.json`.
- `boundaries.json is out of date`: run `pnpm architecture:update` and commit
  `boundaries.json`.

When `fallow audit` reports a `boundary-violation`, import a public entry
point, or move the code so the import is not needed. Do not add a
`fallow-ignore` comment to pass the gate.

Leave unclassified files unclassified.

When editing records, follow README.md for defaults, directory public APIs,
and exclusions. Preserve role restrictions and feature ownership overrides.
Group pure utilities under `shared-foundation` rather than splitting records
by utility name.

Choose tests by the caller behavior or boundary rule they protect, following
`docs/guidance/testing-principles.md`. Reuse existing coverage when it proves
the contract. Cataloging an entry point alone does not require a new test.
