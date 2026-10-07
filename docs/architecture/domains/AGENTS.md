# Domain architecture records

`records/*.domain.json` and `exceptions.json` are hand-edited. `catalog.json`,
`catalog.md`, and `baseline.json` are generated. README.md defines the rules.

When `pnpm architecture:check` fails, act on the message:

- `imports internal <domain> module`: import a declared public entry point, or
  move the code so the import is not needed. Accepting the debt requires the
  domain owner: add the fingerprint to one exception's `exactFingerprints`,
  then run `pnpm architecture:accept-baseline`.
- `resolved fingerprint(s)`: run `pnpm architecture:update` and commit
  `baseline.json`.
- `owners differ from CODEOWNERS`: make the CODEOWNERS line for that path list
  exactly the record's `owners`.
- `is stale`: run `pnpm architecture:update`.
  Leave unclassified files unclassified. Add a public entry point only together
  with a characterization test that covers it.
