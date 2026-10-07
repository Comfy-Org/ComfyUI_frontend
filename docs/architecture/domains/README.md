# Frontend domain catalog

This directory makes architectural ownership and dependency boundaries
discoverable to tools, agents, and reviewers. Domain records declare owned
paths, public entry points, CODEOWNERS, allowed domain dependencies and
consumers, and enforcement maturity. The generated catalog copies the records
and the exception ledger; `architecture:report` prints the live import census.

## Commands

```sh
pnpm architecture:check
pnpm architecture:update
pnpm architecture:report
pnpm architecture:accept-baseline
pnpm test:unit scripts/architecture/check.test.ts
```

`architecture:check` parses TypeScript imports and the script blocks of Vue
files. Every resolved internal declaration is classified as allowed, forbidden,
or legacy. `architecture:report` prints live denominators, declaration counts,
distinct importer counts, and the classified edges without changing committed
files. It also reports unresolved internal-looking relative and `@/` specifiers;
packages remain excluded from internal-edge totals. The census does not model
`vi.mock`, `import.meta.glob`, or `tsconfig` path aliases other than `@/`.
The check fails when:

- an external caller newly imports an enrolled domain's internal file;
- a dependency is not permitted by both the producer's allowed consumers and
  the consumer's allowed dependencies;
- a new `comfy/no-restricted-paths` suppression (`oxlint-disable` or
  `eslint-disable`) appears whose fingerprint is not in `baseline.json`, with
  or without an `architecture-exception:` identifier;
- any declaration-occurrence baseline fingerprint grows; or
- generated catalog files drift from the stable records and exception ledger.

The generated catalog contains stable contracts only. Whole-repository file and
edge totals are deliberately live report data, so routine source changes do not
force catalog churn.

The initial domains are intentionally at `baseline` maturity for deep imports.
An empty `publicEntryPoints` list records that no supported domain API has been
declared yet; existing consumers are debt, not accidental public contracts.
Promotion is incremental: introduce and test an entry point, migrate a finite
consumer cohort, remove its fingerprints, then promote the rule to `error`.

Files outside the enrolled pilots are reported as `unclassified-module`
inventory and never fail the check. That changes only after every `src` module
is assigned a capability and role. Adding or renaming an unclassified file
does not touch the exception ledger unless the file imports an enrolled
domain's internal module. Renaming a baseline-enforced deep-import caller, such
as a mask-editor caller, changes its fingerprint and needs a new
`exactFingerprints` entry and `pnpm architecture:accept-baseline`.
Inventory-only workflow-template callers do not. Imports between enrolled and unclassified
code are `legacy`, and role direction is checked only when both files are
enrolled. The census covers `src/**/*.{ts,tsx,vue}`; `browser_tests`,
workspace packages, and other roots are not scanned.

Do not edit `catalog.json`, `catalog.md`, or `baseline.json` by hand.
`architecture:update` refuses baseline additions. The explicit acceptance
command succeeds only when every baseline violation is owned by exactly one
exception-ledger entry. Every newly admitted fingerprint must also appear
verbatim in the owning entry; a broad historical prefix cannot authorize new
debt. Baseline acceptance must never accompany unrelated product work.
Exact fingerprints and historical prefix scopes are separate ledger fields;
exact ownership wins when both could match, and exact matching never treats one
occurrence suffix as a prefix of another.
`sunset` is review metadata for planned debt retirement; it does not make
unrelated checks fail when the date passes.
When recorded debt is removed, `architecture:check` requires an update and
`architecture:update` deletes only the resolved fingerprints. This prevents a
later reintroduction from inheriting stale baseline permission.

Roles are enforced as dependency direction, not merely catalog metadata. Each
role may import from the roles listed:

- `domain`: `domain`
- `application` and `infrastructure`: `application`, `infrastructure`, `domain`
- `presentation`: `presentation`, `application`, `domain`
- `integration`: every role

The legacy and unclassified totals in `architecture:report` are migration debt
that this PR does not pay down.
