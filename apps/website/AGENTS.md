# comfy.org (`apps/website`)

The marketing site: **Astro, statically built, with Vue islands.** It is not the
ComfyUI frontend. The repository-root `AGENTS.md` describes that other
application — Vue 3 Composition API throughout, litegraph, the ECS and CRDT
layers, `browser_tests/` — and **none of it governs this directory.** Read it
for repo-wide conventions (package manager, commit format, PR process) and
ignore its architecture sections here.

What is different, concretely:

- Pages are `.astro`, rendered at build time. A `.vue` file here is an island,
  hydrated only where a page asks for it.
- There is no runtime server. Every request is answered by a file emitted at
  build time, so "does this ship?" is decided by what the build writes.
- Tests are this package's own: `pnpm --filter @comfyorg/website test:unit`
  (vitest) and `test:e2e` (playwright, `apps/website/playwright.config.ts`).
  `browser_tests/` at the root belongs to the other app.

## Running things here

Use the package scripts. Two ways of reaching past them waste time:

- **`npx vitest` fails** with `globalThis.localStorage?.clear is not a
function` — the root setup file expects an environment the package script
  configures. Use `pnpm test:unit`, which takes a path argument fine.
- **`npx astro` can resolve to a globally cached Astro** rather than the
  workspace one, especially in a fresh worktree, and dies with a misleading
  `createRenderEntry is not a function` from content collections. Use
  `./node_modules/.bin/astro` or `pnpm build`.

`pnpm typecheck` is `astro check && vue-tsc --noEmit` — both, and Astro files
are only covered by the first.

## Build-time data, and the snapshot rule

Several pages are rendered from remote APIs at build time, each with a
committed snapshot as fallback: Ashby (`careers`), Comfy Cloud `object_info`
(`cloud/supported-nodes`, see
[`src/components/cloud-nodes/AGENTS.md`](src/components/cloud-nodes/AGENTS.md)),
and the Workshop catalog below.

Invariants that hold across all of them:

- **Never prefix a build-time secret with `PUBLIC_`.** Astro inlines `PUBLIC_*`
  into the client bundle. A key named that way is published.
- **Validate every remote response with Zod.** The fetcher does not trust the
  network, and the snapshot exists so a flaky upstream cannot fail a build.
- **Production is strict where preview is lenient.** `cloudNodes.build.ts`
  throws on stale data only when `VERCEL_ENV === 'production'`. A consequence
  worth knowing: `VERCEL_ENV=production pnpm build` **fails locally** without
  `WEBSITE_CLOUD_API_KEY`. To reproduce a release build without the key, leave
  `VERCEL_ENV` unset and use `WORKSHOP_IN_BUILD=0`.

## Generated files are committed, packed, and marked

Generated data lives in the repo so builds need no network and no private
credentials. It is sized for the repository rather than for a reader, because
nobody reads it — a script writes it, a schema validates it, a loader consumes
it.

Two entries are needed for every such file, and forgetting either is silent:

- `.gitattributes` → `linguist-generated=true`, so it collapses in review
- `.oxfmtrc.json` → `ignorePatterns`, or the formatter unpacks it on the next
  commit and every line churns

**Generators must be deterministic and idempotent.** Compare parsed content
rather than bytes before writing, so a re-run with no upstream change rewrites
nothing. Never sort committed output with `localeCompare` — it is
host-dependent (`p/ä,p/z` under `LANG=C`, `p/z,p/ä` under `LANG=sv_SE.UTF-8`)
and churns the diff by locale. Use a plain lexical comparison.

## Deploys and previews

Vercel's git integration is **off** (`vercel.json` → `github.enabled: false`).
Everything runs from `.github/workflows/ci-vercel-website-preview.yaml`:

| Trigger        | Command               | `VERCEL_ENV` | Lands                                     |
| -------------- | --------------------- | ------------ | ----------------------------------------- |
| PR             | `vercel build`        | `preview`    | `comfy-website-preview-pr-<N>.vercel.app` |
| push to `main` | `vercel build --prod` | `production` | comfy.org                                 |

Project: `vercel.com/comfyui/website-frontend`. `website-frontend-comfyui.vercel.app`
serves it directly; comfy.org is the same deployment behind Cloudflare.

**The repo is squash-merge only**, with the commit message built from
`PR_TITLE` + `PR_BODY`. So a PR title _is_ the commit message on main — use
conventional commits (`feat(scope): lowercase imperative`), and note that
branch commit messages never reach main's history.

## Vue islands

Astro's Vue integration only surfaces `defineProps` in the generated component
type. **A `defineModel` is not in the props type**, so an `.astro` page cannot
pass `v-model` or `:modelValue` to an island — `vue-tsc` rejects it and no
annotation fixes it. Islands that need an initial value seed themselves and
emit; tests should assert on `emitted()` rather than pass a model prop.

## i18n

`src/i18n/translations.ts` is one flat key map (`en`, `zh-CN`). Because every
feature appends near the top, **merge conflicts in it are almost always
additive** — two branches adding different keys. Keep both sides and close the
brace; check for duplicate keys afterwards rather than picking a side.

## Workshop

Unreleased. Browse and run the models Comfy's Router exposes. Lives across
`scripts/generate-workshop-catalog.ts`, `src/config/workshop-*`,
`src/content/workshop-models.json`, `src/integrations/workshop-release-gate.ts`
and `src/pages/workshop/`.

### It must not reach comfy.org until we say so

`noindex` does not achieve that — it asks a crawler to stay away while the page
stays live at a URL anyone can share. The routes are kept out of the build
instead.

| Environment      | `VERCEL_ENV` | Workshop | Answers                        |
| ---------------- | ------------ | -------- | ------------------------------ |
| Production       | `production` | out      | what is on comfy.org right now |
| Preview, staging | `preview`    | out      | what ships if we release today |
| Development      | unset        | in       | what we are building           |

Preview matches production **deliberately**. A preview carrying an unreleased
feature cannot answer the one question a preview exists for: if we cut a
release right now, for a hotfix say, what goes out?

`WORKSHOP_IN_BUILD=1` overrides it. CI sets it on a PR labelled `workshop`, and
that is how the feature gets a review URL; production gets it on launch day. No
code change either time. An unlabelled PR leaves the variable **undefined**
rather than empty, so that the Vercel environment value governs once it exists
— otherwise launch would turn Workshop on in production while every preview
overrode it back off. `CI: Website Build` builds the excluded shape too, and
asserts the directory is gone **and** the build exited 0.

### Two ways the gate has already broken

Both cost a debugging session. Do not reintroduce them.

- **`astro:routes:resolved` cannot stop a route being generated.** The hook
  reports resolved routes; mutating the array changes nothing. The gate removes
  emitted output at `astro:build:done` instead, and throws if it is still there.
- **No dynamic `import()` inside `astro:build:done`.** By that hook Vite's
  module runner is closed and it throws "Vite module runner has been closed".
  Import statically.

The second one is the more instructive failure: it removed the output correctly
and _then_ failed the build, so page counts looked right while every deploy
died. **Verify a build by counting emitted files _and_ checking the exit code.**
Either alone will lie to you.

The 268 model pages come from `getStaticPaths`, so they can be skipped at the
source; only `/workshop/index.astro` is a static route that has to be removed
after the fact.

### The catalog

`src/content/workshop-models.json` — one packed JSON array, a line per model,
generated by `pnpm generate:workshop-catalog <partner-client.mjs> <ref>` from a
**private** repo's bundle, which is why it is committed rather than fetched.

Loaded with Astro's `file()` loader, not `glob()`: `file()` takes an array of
objects with unique `id`s, which these have. Consumers read `entry.data` and
never the collection's generated id, so the loader is free to change.

### The single most expensive thing to know

**A model's `parameters` describe a normalized authoring shape that neither
backend accepts.** Measured across 259 models: **0** request bodies match the
form's shape, **0** request URLs are derivable from the model `id`, and 106
remap the id to a string absent from the catalog.

```
our form  {"model":"vertexai/gemini-2.5-flash-image","prompt":"a red cube"}
the wire  {"contents":[…],"generationConfig":{…},"systemInstruction":{…}}
```

Both Comfy Router and `/proxy/*` want the partner's raw native protocol, and
the partner-node bundle is the translator between the two — request builders,
media strategies, per-provider poll loops, response normalization.

Consequences to hold on to:

- **A 200 does not mean the input arrived.** Router accepts
  `bfl/flux-kontext-max` while silently dropping the reference image, and names
  Ideogram's field `text_prompt`, so a `prompt` is discarded and the run
  succeeds with the wrong result. Treat any "just post the form" change as
  wrong until proven otherwise.
- **Only 14 of ~200 Router models have an authored input schema**, so Router
  cannot be the source of these forms today.
- **BFL results are billed and then lost** (FE-2032). Polling bypasses the
  proxy and races a hardcoded region list `["us1","us2","us3","us4","eu1"]`;
  `eu2` appears nowhere in the bundle, so an `eu2` job is unreachable. This
  affects platform.comfy.org too, not just here.
