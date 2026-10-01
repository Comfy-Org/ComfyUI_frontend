# Domain architecture records

`records/*.domain.json` is the source of truth for enrolled frontend domains.
Run `pnpm architecture:update` after a record or exception-ledger change and
`pnpm architecture:check` for the non-mutating CI gate. Baseline additions are
never part of update: only `pnpm architecture:accept-baseline` can accept them,
and that command requires a separately reviewed exception change.
New fingerprints require verbatim ledger coverage during acceptance; existing
broad prefixes document historical debt only and cannot admit future growth.

Module paths are repository-relative and pair a capability with an architectural
role. A path may name one file or end in `/**`. Paths must match real files,
must not overlap across domains, and must retain the record's CODEOWNERS. Every
public entry point must belong to its domain.

Enforcement maturity is explicit:

- `inventory` reports the condition without gating it.
- `baseline` rejects new fingerprints while allowing recorded debt to shrink.
- `error` permits no violation.

Do not add a public entry point merely to silence a deep-import finding. It is
a contract: document and characterize it before promotion. Keep allowed
dependencies and consumers reciprocal. Every baseline fingerprint must map to
exactly one exception with an owner, rationale, sunset, and removal criterion.
