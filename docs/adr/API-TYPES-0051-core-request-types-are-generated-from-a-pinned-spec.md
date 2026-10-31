# ADR-API-TYPES-0051: Core request types are generated from a pinned spec

Date: 2026-10-30

## Status

Proposed

## Context

`QueuePromptRequestBody` in `packages/api-client/src/ComfyApi.ts` describes the
body this repo posts to core's `POST /api/prompt`, and every member of it is
hand-written. The spelling, the optionality and the value type of each one can
drift from the server without failing anything here, because nothing connects
the interface to a schema.

Core does publish a schema: `openapi.yaml` at the root of `Comfy-Org/ComfyUI`
defines `PromptRequest` with `prompt`, `extra_data`, `front`, `number`,
`partial_execution_targets`, `workflow_id`, `workflow_version_id` and
`workflow_metadata`.

The gap surfaced on #22013, which adds `workflow_metadata` to carry the routing
contract merged in Comfy-Org/ComfyUI#16763 and #16809. Its shape was read off
the spec by hand and is correct, which is the problem: nothing would have caught
it if it were not.

## Decision

**Generate core's `PromptRequest` from a vendored, pinned copy of core's own
`openapi.yaml`, and index it rather than restate it.**

`packages/comfyui-api-types` vendors the spec at a recorded commit and sha256,
filters generation to `POST /api/prompt`, and exports a hand-written
`src/index.ts` whose only job is to make the derivation load-bearing:

```ts
type StringMap<T extends Record<string, string>> = T

export type PromptWorkflowMetadata = StringMap<
  NonNullable<PromptRequest['workflow_metadata']>
>
```

**Indexing alone is not enough, and this was the first version's mistake.**
`NonNullable<PromptRequest['workflow_metadata']>` fails when the member is
deleted, but a retype is adopted in silence: change the spec's
`additionalProperties.type` to `integer` and the alias simply becomes
`{ [key: string]: number }` and compiles. That is the more likely and more
dangerous change, because the field keeps its name while its meaning moves. The
`StringMap` constraint is what turns it into `TS2344`.

**The pin is the unit of trust, not "latest".** Core versions independently of
the frontend, so generated types describe the core revision pinned in the
package, not whichever core a user is running. A floating fetch would make the
frontend's types change without a frontend commit.

**The derivation must be falsifiable, in both directions.** `pnpm
typecheck:workspaces` runs the package typecheck in CI, and three spec states
were checked against it: unmodified passes; the member deleted gives `TS2339`;
the value type changed to `integer` gives `TS2344`. A derived type that survives
its schema losing the field is decoration, and one that survives the field
changing meaning is worse, because it reads as verified.

**Scope is one endpoint.** The spec describes 68 paths; the filter admits one, so
the generated surface is ~125 lines.

## Alternatives considered

**Derive it from `@comfyorg/ingest-types`.** Rejected, and this is the one worth
recording because the package looks like the obvious home. Its `PromptRequest`
carries the same members minus `workflow_metadata`, which reads as a stale copy
of core's. It is not: that package is generated from Cloud's _projected_ ingest
spec and pushed here by `push-ingest-types-to-frontend.yml` in `Comfy-Org/cloud`
on a force-pushed branch, so a local regen cannot add the field and a hand edit
to its `src/*.gen.ts` would be overwritten. The field is absent there
deliberately — the Cloud gateway never reads `workflow_metadata`, it assigns
`prompt_id` and `workflow_id` onto outbound frames itself. Deriving a core-owned
field from a schema that excludes it on purpose would encode the wrong owner.

**Migrate the whole interface at once.** Rejected for this change. `client_id`
is not in core's `PromptRequest` at all, and `extra_data` is an open record in
the spec while this repo depends on a specific `extra_pnginfo.workflow` shape,
so deriving those members needs extension rather than replacement. Tracked on
[#22309](https://github.com/Comfy-Org/ComfyUI_frontend/issues/22309).

**A generator script under `scripts/` instead of a package.** Held as the
fallback in case the generated output was too large to vendor. It was not, so
the package — which `pnpm typecheck:workspaces` already covers without new CI
wiring — won.

**Fetch the spec at build time.** Rejected. It makes the build depend on
GitHub's availability and makes the types a function of wall-clock time rather
than of the committed tree.

## Consequences

**Refreshing the pin is manual and nothing automates it.** This is the real cost
and it is accepted knowingly: the package records the commit, the date and the
sha256, and a stale pin means the types describe an older core rather than
anything incorrect at the pin. Automating the refresh the way `ingest-types` is
automated — a push-on-merge job in the producing repo — is part of #22309.

**The full 245 KB spec is in the tree.** Vendoring the whole document rather
than a hand-trimmed excerpt means widening the operation filter later needs no
new fetch and introduces no second source of truth.

**The vendored spec is exempt from this repo's style gates, and has to be.** A
recorded sha256 is only verifiable if the file is byte-identical to core's, so
a reader can fetch core's copy at that commit and compare. Both gates had to be
told: `oxfmt` reindents the document, and `yamllint` fails it, because core's
indentation is core's own. Restyling it and failing CI over it are both wrong
for the same reason — the file is upstream's artifact, not this repo's source.
A reformat changes nothing in the generated types, so nothing fails; it just
invalidates the pin silently. `.oxfmtrc.json` `ignorePatterns` and `.yamllint`
`ignore` now both list it, each with the reason.

The general rule, which generalises past this package: **a vendored upstream
file carrying a recorded hash joins every style gate's ignore list in the same
commit that vendors it.**

**The package is `private` and generates types only.** No npm publish surface,
no entry in `ci-packages-pack.yaml`, no zod plugin. Request-time validation
against the generated schemas was not taken up here and is not implied.

**Revisit if** #22309 lands the automated sync, at which point the vendored spec
and the manual refresh note should be removed rather than left alongside it.
