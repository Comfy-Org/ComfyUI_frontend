# Frontend domain catalog

This directory records which `src` paths belong to which domain, the role
each path plays, and which domains may depend on each other. Fallow enforces
the boundaries; `tools/architecture` generates its config from the records and
tracks architecture suppressions.

## Commands

```sh
pnpm architecture:check    # validate records, ledger, and boundaries.json
pnpm architecture:update   # regenerate boundaries.json from the records
pnpm architecture:catalog  # print records, CODEOWNERS owners, and exceptions as JSON
pnpm test:unit tools/architecture
```

## Files

- `records/*.domain.json`: one hand-edited record per domain. The zod schema
  in `tools/architecture/src/schema.ts` defines the fields and rejects unknown
  ones.
- `exceptions.json`: the hand-edited ledger of architecture suppressions.
- `boundaries.json`: generated Fallow `boundaries` config, loaded through
  `extends` in `.fallowrc.jsonc`. Do not edit it by hand.

Owners come from `CODEOWNERS`; records do not repeat them.

## Boundaries

Each record role becomes a Fallow zone (`<domain>/<role>`), and each public
entry point becomes a `<domain>/<role>/public` zone. Every other `src` file
falls into the `unclassified` zone. The generated rules allow:

- imports within a domain that follow role direction:
  - `domain`: `domain`
  - `application` and `infrastructure`: `application`, `infrastructure`,
    `domain`
  - `presentation`: `presentation`, `application`, `domain`
  - `integration`: every role
- imports from a domain into another domain's public entry points, when the
  consumer lists the producer in `allowedDependencies`, the producer lists the
  consumer in `allowedConsumers`, and role direction allows it;
- imports from unclassified code into any public entry point;
- imports from any zone into unclassified code.

`deepImports: "inventory"` opens a domain's internal zones to unclassified code
and approved consumers. `deepImports: "enforced"` limits outside callers to
public entry points.

The pre-push hook and the `CI: Fallow` job run `fallow audit` with the
`new-only` gate, so only newly introduced violations fail. Existing violations
are inherited findings, and `pnpm exec fallow dead-code --boundary-violations`
lists them. An empty `publicEntryPoints` list means the domain has no supported
API yet. To add one, list a tested entry point, then migrate callers to it.

Fallow analyzes only files reachable from its entry points. A new file that
nothing imports is reported as an unused file, not as a boundary violation.

## Suppression ledger

`architecture:check` scans the comments in `src/**/*.{ts,tsx,vue}` for
suppressions of the layer rule (`eslint-disable` or `oxlint-disable` naming
`comfy/no-restricted-paths`, or a blanket disable), and for
`fallow-ignore-next-line` or `fallow-ignore-file` comments that name
`boundary-violation` or no issue type. The check fails when:

- a suppression is not listed in exactly one exception's `exactFingerprints`;
- a suppression names `architecture-exception: DDD-EX-NNN` but a different
  exception lists it;
- a listed fingerprint no longer exists; or
- `boundaries.json` differs from what the records generate.

`sunset` is review metadata; the check does not fail when the date passes.
