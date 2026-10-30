# Frontend domain catalog

This directory records which `src` and workspace package paths belong to
which domain, the role each path plays, and which parts of each domain other
domains may import. Fallow enforces the boundaries; `tools/architecture` generates its
config from the records and tracks architecture suppressions.

## Commands

```sh
pnpm architecture:check    # validate records, ledger, and boundaries.json
pnpm architecture:update   # regenerate boundaries.json from the records
pnpm architecture:catalog  # print records, owners, dependencies, exceptions, and coverage as JSON
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

## Module paths

A module path is a file or a directory ending in `/**` under `src/` or
under a workspace package's `packages/<name>/src/`. Prefer directories: a file
added under a claimed directory joins its domain without a record change.
Paths may nest. Each file belongs to the most specific path that matches it: a
file path beats any directory, and a deeper directory beats a shallower one.
Claim a directory for its main domain and role, then claim the exceptions
inside it. A test that no module names belongs with the file path
it checks: `foo.ts` claims `foo.test.ts` and `foo.cloud.test.ts`, and the
longest matching file path wins. A source file with the test's own name, such
as `foo.cloud.vue`, is always the subject, so a test never inherits a role past
it. List a test only when its domain or role differs from its subject's. Two
modules may not name the same path, and
`architecture:check` warns about a path whose nearest enclosing path, or whose
subject, has the same domain and role.

`architecture:catalog` also reports classification coverage: each domain's
`sourceFileCount`, and a top-level `coverage` object with `total`,
`classified`, and `unclassified` counts plus the sorted `unclassifiedFiles`
list. Coverage counts `src/**/*.{ts,tsx,vue}` and
`packages/*/src/**/*.{ts,tsx,vue}`, tests included. It excludes `apps/`,
package files outside `src/` such as build and test configs, and non-code
files such as JSON, CSS, and assets, so 100% coverage means every `src` and
package `src` code file belongs to a domain.

## Boundaries

Each record role becomes a Fallow zone (`<domain>/<role>`), and each public
entry point becomes a `<domain>/<role>/public` zone. Inventory domains share
one `_inventory/<role>` zone per role, because any domain may import them and
Fallow rules must name every zone they allow. Fallow puts a file in the first
zone that matches it, so a path that contains another domain's or role's path
moves to a later `outer-<n>` zone with the same rules.
Every other `src` or package `src` file falls into the `unclassified` zone.
The generated rules allow:

- imports within a domain that follow role direction:
  - `domain`: `domain`
  - `application` and `infrastructure`: `application`, `infrastructure`,
    `domain`
  - `presentation`: `presentation`, `application`, `domain`
  - `integration`: every role
- imports from another domain into a public entry point, or into any zone of
  a domain whose `deepImports` is `"inventory"`, when role direction allows
  it;
- the same imports from unclassified code, in any role direction;
- imports from any zone into unclassified code.

`deepImports: "enforced"` limits outside callers to public entry points.
Records do not declare which domains they depend on or who may import them.
`architecture:catalog` reports each domain's observed `dependencies`: every
other domain it imports, with the number of file-to-file imports, read from
Fallow's module graph.

The pre-push hook and the `CI: Fallow` job run `fallow audit` with the
`new-only` gate, so only newly introduced violations fail. Existing violations
are inherited findings, and `pnpm exec fallow dead-code --boundary-violations`
lists them. An empty `publicEntryPoints` list means the domain has no supported
API yet. To add one, list a tested entry point, then migrate callers to it.

Imports through `@comfyorg/*` reach package source only because each package
export lists the package's own name as its first condition, pointing at `src`,
and `.fallowrc.jsonc` lists that name in `resolve.conditions`.
Without it Fallow follows the `types` condition to the built declarations,
which are outside every zone. A new package needs both.

Fallow analyzes only files reachable from its entry points. A new file that
nothing imports is reported as an unused file, not as a boundary violation.

## Suppression ledger

`architecture:check` scans the comments in the covered code files for
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

`architecture:check` warns, without failing, about covered code files no
domain claims and module paths that match no files, so adding, moving, or
deleting a file does not block a pull request. In GitHub Actions each warning is an
annotation on the file to categorize or the record to update, and the
findings appear in the **Architecture** section of the shared PR report
comment, or for fork PRs in the job summary (`--report <file>` writes that
section's Markdown).
`architecture:catalog` lists the full `unclassifiedFiles` backlog.
