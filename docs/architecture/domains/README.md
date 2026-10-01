# Frontend domain catalog

This directory makes architectural ownership and dependency boundaries
discoverable to tools, agents, and reviewers. Domain records declare owned
paths, public entry points, CODEOWNERS, forbidden domain edges, and enforcement
maturity. The generated catalog summarizes the declarations and current import
census without moving product code.

## Commands

```sh
pnpm architecture:check
pnpm architecture:update
pnpm architecture:report
pnpm architecture:accept-baseline # only with explicit exception approval
pnpm test:unit scripts/architecture/check.test.ts
```

`architecture:check` parses TypeScript imports and the script blocks of Vue
files. Every resolved internal declaration is classified as allowed, forbidden,
or legacy. `architecture:report` prints live denominators, declaration counts,
distinct importer counts, and the classified edges without changing committed
files. It also reports unresolved internal-looking relative and `@/` specifiers;
packages remain excluded from internal-edge totals. The first wave does not yet
model `vi.mock`, `import.meta.glob`, or arbitrary `tsconfig` path aliases.
The check fails when:

- an external caller newly imports an enrolled domain's internal file;
- a dependency is not permitted by both the producer's allowed consumers and
  the consumer's allowed dependencies;
- an architecture import-rule suppression lacks an `architecture-exception:`
  identifier;
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

Unclassified `src` modules are inventory-only during Wave 1 because total
classification is not yet complete. Promote that signal to a no-new/error gate
only after every legacy module has an accepted capability and role; until then,
ordinary additions and renames outside enrolled pilots do not edit the shared
exception ledger. Imports between enrolled and unclassified code remain
`legacy`, and role direction is enforced only when both endpoints are enrolled.
The census covers `src/**/*.{ts,tsx,vue}`; `browser_tests`, workspace packages,
and other roots are outside this first-wave census.

Do not edit `catalog.json`, `catalog.md`, or `baseline.json` by hand.
`architecture:update` refuses baseline additions. The explicit acceptance
command succeeds only when every baseline violation is owned by exactly one
exception-ledger entry. Every newly admitted fingerprint must also appear
verbatim in the owning entry; a broad historical prefix cannot authorize new
debt. Baseline acceptance must never accompany unrelated product work.
Exact fingerprints and historical prefix scopes are separate ledger fields;
exact ownership wins when both could match, and exact matching never treats one
occurrence suffix as a prefix of another.
When recorded debt is removed, `architecture:check` requires an update and
`architecture:update` deletes only the resolved fingerprints. This prevents a
later reintroduction from inheriting stale baseline permission.

Roles are enforced as dependency direction, not merely catalog metadata.
`domain` targets only `domain`; `application` and `infrastructure` may target
each other and `domain`; `presentation` may target presentation, application,
and domain; and `integration` is the composition role that may target all
roles. The remaining legacy and unclassified totals in `architecture:report`
are explicit migration debt, not a claim that the program exit gate is met.
