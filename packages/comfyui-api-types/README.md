# @comfyorg/comfyui-api-types

TypeScript types for the ComfyUI server API, generated from core's own OpenAPI
spec rather than written by hand.

This exists because the frontend's request and response shapes for core
endpoints were all hand-written, so a server-side rename or retype could not
fail anything here.

`src/index.ts` indexes the generated `PromptRequest` instead of restating it.
Indexing alone only catches the member disappearing — a retype is adopted
silently, because the alias just becomes whatever the spec now says. So the
alias is also constrained to `Record<string, string>`, which is what makes a
changed value type fail as well. Both failure modes are checked below.

## Scope

One endpoint: `POST /api/prompt`. `openapi-ts.config.ts` filters to it, so the
generated surface is ~125 lines out of a spec describing 68 paths.

Nothing imports this package yet. `QueuePromptRequestBody` in
`packages/api-client` is still hand-written, and that package does not depend on
this one — `ComfyApi` is where the request body is built, so the dependency
belongs there rather than on the app when it is added. That wiring is #22013,
which cannot reference this package until it is on `main`.

Widening the filter to the rest of the API, and deriving the remaining members
of `QueuePromptRequestBody` from it, is deliberately not done here — it is
tracked on
[#22309](https://github.com/Comfy-Org/ComfyUI_frontend/issues/22309) along with
the question of how the frontend's own additions (`client_id`, and the narrower
`extra_data.extra_pnginfo` shape this repo depends on) survive the derivation.

## The pin

`openapi.yaml` is vendored from the root of `Comfy-Org/ComfyUI` at

|        |                                                                    |
| ------ | ------------------------------------------------------------------ |
| commit | `4281eb0a1478ce445dc32c4b0895f14c9fc3c1be`                         |
| dated  | 2026-10-25                                                         |
| sha256 | `8f0da8543086cee71e3fef3ca3a8128c8fd5895bfed590d7a96d4053ea424df7` |

The full spec is vendored rather than a hand-trimmed excerpt, so widening the
operation filter later needs no new fetch and no second source of truth.

**`openapi.yaml` is exempt from this repo's style gates, and must stay exempt:**
it is listed in `.oxfmtrc.json`'s `ignorePatterns` and in `.yamllint`'s
`ignore`. The sha256 above is only useful if the file is byte-identical to
core's, so that a reader can fetch core's copy at that commit and compare.
Core's indentation is its own, and both restyling it and failing CI over it are
the wrong answer — the document is upstream's artifact, not this repo's source.
A reformat is semantically identical and changes nothing in the generated types,
so nothing would fail; it would just quietly invalidate the pin.

`pnpm --filter @comfyorg/comfyui-api-types check:generated` enforces the pin
rather than just recording it. It verifies `openapi.yaml.sha256`, regenerates,
and fails on any diff between the result and what is committed. The spec and
its checksum are compared against the commit too, not just the generated output:
a refresh that commits the spec and the types but leaves the re-recorded hash
uncommitted would otherwise pass here and fail for everyone who checks it out
afterwards.

Both legs are load-bearing. A reformat, or a refresh whose hash was not
re-recorded, fails the checksum. A refresh that updates the hash but skips
`generate` fails the diff — the case that is otherwise invisible, because stale
types still compile and describe an older revision while every other check
stays green.

The diff is taken against `HEAD` rather than the index. Regenerated output that
is staged but never committed matches the index, so an index comparison would
pass while the push still carried the stale version.

It runs in the pre-push hook, next to `knip` and `fallow`. Wiring it into CI as
well belongs with the automated spec sync on #22309, since both answer the same
question of who keeps the pin current.

**Refreshing it is manual, and nothing automates it yet.** Core versions
independently of the frontend, so these types describe the core revision pinned
above, not whichever core a user is running. To move the pin, from this
directory:

```bash
# 1. Replace the spec with core's copy at the commit you are pinning to.
# 2. Re-record the hash, or check:generated fails on the stale one.
node -e "const{createHash}=require('node:crypto'),{readFileSync,writeFileSync}=require('node:fs');writeFileSync('openapi.yaml.sha256',createHash('sha256').update(readFileSync('openapi.yaml')).digest('hex')+'  openapi.yaml\n')"
# 3. Regenerate, and commit the result — stale committed output is what
#    check:generated exists to catch.
pnpm --filter @comfyorg/comfyui-api-types generate
oxfmt --write src/generated
# 4. Update the commit, date and sha256 in the table above.
```

Automating that the way `ingest-types` is automated — a push-on-merge job in the
producing repo — is part of #22309.

## Verifying the derivation is load-bearing

A derived type that does not break when the schema changes is decoration. Edit
the `workflow_metadata` block under `PromptRequest.properties` in
`openapi.yaml`, run `pnpm --filter @comfyorg/comfyui-api-types generate`, then
`… typecheck`. Three states, all three checked:

| Spec                                         | Typecheck                                                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| unmodified, at the pin                       | passes                                                                                                     |
| member deleted                               | `error TS2339: Property 'workflow_metadata' does not exist on type 'PromptRequest'`                        |
| `additionalProperties.type` set to `integer` | `error TS2344: Type '{ [key: string]: number; }' does not satisfy the constraint 'Record<string, string>'` |

The third row is why the alias carries a constraint instead of a bare
`NonNullable<…>`. Without it a retype regenerates to
`{ [key: string]: number }` and compiles clean, so the derivation would catch a
deleted member and miss a silently changed meaning.

`pnpm typecheck:workspaces` runs this in CI, so both failures gate rather than
advise.
