# Domains: tracking self-contained modules

The second phase after untangling import cycles: give every module in
`src/` an owning domain and an architectural role, enforce the boundaries
between domains, and extract domains that have become independent into pnpm
workspace packages. The Gordian Knot site tracks that progress next to the
knots, from the same commits and open pull requests.

## Phases

1. **Set the rules.** Christian's stack adds the domain catalog and the
   census in `tools/architecture`: #19768 (census, exception ledger,
   ratchet), #19855 (image crop, compare, painter) and #19856 (image
   compositor). Domain records live in `docs/architecture/domains/records`.
2. **Track.** Classify more of `src/` and retire recorded debt: deep imports
   into a domain's internals, forbidden role or domain edges, and
   `comfy/no-restricted-paths` suppressions. Promote each domain's
   enforcement from `inventory` to `baseline` to `error`.
3. **Extract.** Move each domain that is ready into its own package under
   `packages/`.

## Data

`scripts/census.mjs` runs after `cruise.mjs` and `open-prs.mjs` and measures
every main commit, pull request head and fork point they analysed. It
imports `loadArchitectureConfiguration` and `censusRepository` from the tool
and writes `<work>/architecture/<sha>.json`. `build-data.mjs` puts that object
on each state as `architecture`.

- Every tree is measured with one pinned copy of `tools/architecture`, so the
  history stays comparable. The pin is the main or pull request head whose
  tool changed most recently, unless a ref is passed. A tree the pinned tool
  cannot load falls back to its own copy, recorded as `tool.own`.
- A tree without domain records is `status: "no-records"`; the tool is not
  run. Its workspace package list is still recorded.
- Per state: totals (source files, files in domains, domains, ready and
  extracted domains, allowed, legacy and forbidden imports, deep imports,
  suppressions), one entry per domain, and links: import counts between
  each pair of domains and between a domain and unclassified code.
- Per domain: files and files per role, imports inside, in and out, deep
  imports into it, forbidden imports touching it, public entry points,
  enforcement, the readiness checks, and whether it is extracted.

### Ready to extract

A domain is ready when all of these hold:

| Check                        | Meaning                                                     |
| ---------------------------- | ----------------------------------------------------------- |
| `noDeepImports`              | No outside file imports a module that is not an entry point |
| `noUnclassifiedDependencies` | It imports nothing from unclassified code                   |
| `noForbiddenEdges`           | No forbidden import starts or ends in it                    |
| `publicEntryPoint`           | It declares at least one public entry point                 |
| `enforced`                   | Deep imports and dependencies are both enforced at `error`  |

A domain counts as extracted when every module path in its record is under
`packages/`.

## Views

Built in the first version:

- **Domains tab** in the side panel. Summary sentence, totals with the change
  against the state below (the parent commit, or the pull request below in a
  stack), one card per domain with its counts and readiness checks, and
  "Progress by tree": main and every open pull request that has domain
  records, in stack order. Picking a row selects that state.
- **Domain map.** While the Domains tab is open the module map is replaced by
  a graph: domains on a ring around one node for all unclassified code,
  circle area by files, lines by import count, coloured allowed, legacy or
  forbidden. Circles and lines animate between states.

Next:

- Timeline chart series for files in domains, deep imports, forbidden
  imports and suppressions once main has domain records (after #19768
  merges), so merged pull requests show as steps like the knot lines.
- Workspace package count and extraction milestones on the timeline.
- Colour the knot map by domain, to show where knots and domains overlap.

## Open decisions

- Whether the readiness checks above match the program's own criteria in
  [domain-driven-design-program](https://github.com/christian-byrne/domain-driven-design-program).
- Whether to keep pinning the newest tool or pin a fixed release once the
  tool lands on main.
