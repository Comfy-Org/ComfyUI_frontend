> # ⚠ WORK IN PROGRESS — SHOULD NOT BE SUBMITTED TO MAIN
>
> A working design artifact living on `benjcooley/magic-patch` so it is version
> controlled and reviewable alongside the code it describes. It is **not** a
> finished document and is not intended to land on `main` in this form. When the
> design settles, the durable parts become a proper ADR under `docs/adr/` and
> this file goes away.

# Magic Patch — precomputed migration patches for custom-node JS

**Status:** working design artifact. An ADR will be cut from a subset once
settled. Companion to `node_api_WIP.md`, which specifies the API this depends on.

**Architecture:** patches are **generated offline, verified against the test
harness, and shipped as a hash-keyed manifest.** The client does a hash lookup and
applies a known-good artifact. No model runs on the user's machine.

**Goal:** move custom-node JS off deprecated and unpublished APIs onto a real
published API — so the old surfaces can be **deleted**, not carried forever.

**Scope:** desktop + localhost. PoC: config-gated, off by default, silent, one toast
with a count.

---

## Adding to the API

Any capability added to `src/platform/nodeApi/` is finished only when the skill
can teach it. Three things, in the same change:

1. **A capability entry** in `CAPABILITIES` (`comfyApi.ts`), so `supports()`
   answers honestly and `apiSurface.ts` regenerates.
2. **An intent rule** in `SKILL.md` — _"if you are converting X, check whether
   it is for Y, and use Z"_. Not a mapping table entry. Agents convert what they
   recognise, and they recognise intent, not call names. `onPreview` is the
   example: an agent asked for `api.addEventListener`, which is a faithful port
   of the shape that causes the problem.
3. **A reference example** in `references/` if the shape is not obvious from one
   line.

An API the skill cannot teach converts nothing. It shows up as an `api-gap`
punt naming a capability that already exists, which is worse than a real gap
because it looks like a missing feature.

## 0. The shape

**One generator, two sinks.** The patch engine is identical either way; only where
the output lands differs.

```
                    ┌──────────────── ONE GENERATOR (CI) ────────────────┐
                    │  corpus → detect → patch (rules; agent for residue)│
                    │              → verify against the matrix           │
                    └───────────────────────┬───────────────────────────┘
                                            │
             ┌──────────────────────────────┴──────────────────────────────┐
             ▼                                                             ▼
   SINK A — upstream PR                                    SINK B — shipped manifest
   registry pack, author opted in                          everything else
             │                                                             │
   adds a new web dir with                                 nodes_patches, hash-keyed
   upgraded JS; author merges                              applied at load on the user's
             │                                             machine
             ▼                                                             ▼
   fixed at the source, for                                fixed for our users only,
   every user of that pack                                 until upstream catches up
```

Sink A is strictly better where it's available: the fix lands at the source, helps
every user of that pack regardless of frontend distribution, and needs no runtime
machinery at all. Sink B is the fallback, and it is unavoidable — **many custom nodes
aren't in the registry**, are installed by git URL or dropped into `custom_nodes/`
by hand, and many registry authors will never opt in or respond.

Both sinks consume the same verified diff. Sink A is a delivery decision, not a
different product.

There is a third output, **Sink C** (§10): where a custom node duplicates something
Comfy now ships natively, replace it rather than patch it. Different artifact
(keyed by node type), different transform (graph rewrite, not source), different
verification, and — unlike A and B — it should _not_ be silent. Shipped last.

---

## 1. Why this is the right call

The previous draft put an agentic loop in the browser. This is better on every axis
that matters, and it is worth being explicit about how much it deletes:

| Previous design                                                 | This design                                                                                                                                           |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM in the client                                               | **Gone.** No API keys in localStorage, no provider abstraction, no CORS work for Anthropic/Ollama, no consent flow for shipping user code off-machine |
| Model-authored code executed unreviewed                         | **Reviewed, tested, versioned artifacts** — same trust level as shipping frontend code                                                                |
| Capability-diff validator, guardrail layers, claim verification | **Gone.** Verification moved to CI, where it can run the real harness instead of regex heuristics                                                     |
| First run degraded, "reload to apply"                           | **Gone.** Patch is present before the user ever hits the pack                                                                                         |
| Patch quality varies per user by model/provider                 | **Identical for every user.** Reproducible, bisectable, revertable                                                                                    |
| Failure = broken pack in front of a user                        | Failure = **red CI**, before release                                                                                                                  |

The AI doesn't disappear — it **relocates to where it can be verified**. In CI it has
the full 3 GB corpus, the 1,801-pack execution matrix, and the byte-identical
`graphToPrompt` invariant to check against. In the browser it had a regex.

That is the whole argument: _a patch good enough to ship silently is a patch that
must be verified before shipping, and verification is only possible offline._

---

## 2. Step 1 — commit to a published API

> **Specified in full in `docs/node_api_WIP.md`.** Closed proxy handles + free functions, no
> internal object reachable. Its completeness test is that every census surface below
> has exactly one destination — which it now does, including the vue-only cohort.

This is the precondition, the hardest item, and correctly listed first. You cannot
migrate code onto a target that doesn't exist.

**The scoping rule:** a migration is possible iff a documented replacement exists.

Two useful facts:

**(a) Much of the mapping is already written down.** The deprecation warnings
prescribe, they don't just flag:

```ts
// src/lib/litegraph/src/node/NodeOutputSlot.ts:26-44
'output.links is deprecated. Read connectivity via node.isOutputConnected(slot) /
 node.getOutputNodes(slot); enumerate links via outputLinks(graph, node.id, slot);
 mutate via node.connect() / node.disconnectOutput().'
```

So for the unconditional cohort, "the published API" largely means **publishing what
is already there** — `slotLinks.ts` helpers, `isInputConnected`, `getOutputNodes`,
`connect`/`disconnect` — and committing to them.

**(b) The vue-only cohort is blocked on API that does not exist.** From the census
(`~/comfy/nodes-compat-study`, 4,969 packs):

| Surface                 | Packs   | Replacement today                   |
| ----------------------- | ------- | ----------------------------------- |
| `out_links_write`       | 58      | ✅ documented                       |
| `link_endpoint_write`   | 36      | ✅ documented                       |
| `node_shape_write`      | 27      | ✅ enum, not string                 |
| `slot_spread`           | 23      | ✅ read fields explicitly           |
| `in_link_write`         | 21      | ✅ documented                       |
| `type_write_nodevar`    | 11      | ✅ usually delete the line          |
| `widgets_splice`        | **286** | ❌ no public reorder API            |
| `widget_type_write`     | **270** | ❌ no successor to converted-widget |
| `converted_widget`      | **238** | ❌ same                             |
| `widgets_assign`        | **226** | ❌ same as splice                   |
| `widgets_push`          | **142** | ❌ same as splice                   |
| `hook_getCustomWidgets` | **91**  | ❌ `widgetRegistry` table is closed |

**~124 packs (16.1% of installs) are migratable today. ~653 packs (35.0%) are
waiting on an API decision.** The bottom six rows are the single highest-leverage
item in this document — they are ~80% of the affected mass, and no amount of
patching machinery touches them until someone publishes a widget-reorder API and a
Vue-widget registration API.

Recommendation: **scope the PoC to the top six rows**, and treat the bottom six as
the API work that step 1 actually refers to.

---

## 2a. The assembled pipeline

Three parts, one flow:

```
OFFLINE (CI)                                  RUNTIME (desktop / localhost)
──────────────────────────────                ─────────────────────────────────
corpus of registry packs                      GET /api/extensions
      ↓                                             ↓
detect old-API use                            fetch each .js  → sha256
      ↓                                             ↓
convert to docs/node_api_WIP.md surface                look up hash in conversion DB
  (rules; agent for residue)                        ↓
      ↓                                       hit  → serve converted artifact,
verify: matrix + wire-identical                      bound to its declared major
      ↓                                       miss → serve original unchanged
conversion DB, keyed by sha256                      ↓
                                              app runs; converted packs speak
                                              only the published API
```

### The artifact record

Each entry pins the source it was verified against **and the API major it
targets** — which is what makes "all majors stay supported" load-bearing rather
than decorative:

```jsonc
{
  "<sha256-of-original>": {
    "pack": "rgthree-comfy",
    "file": "web/comfyui/base_node.js",
    "apiMajor": 1, // docs/node_api_WIP.md §2 — the contract it uses
    "rules": ["type-write-noop", "output-links-mutation"],
    "author": "rules", // or "agent:<model>", then human-reviewed
    "verified": {
      "wireIdentical": true,
      "deprecationsBefore": 12,
      "deprecationsAfter": 0,
      "matrixVerdict": "SAME"
    },
    "artifact": "<converted source>"
  }
}
```

A converted pack declares `apiMajor` and the loader hands it exactly that
surface. A pack converted today against v1 keeps running after v2 ships, without
reconversion — which is the only way this stays a one-time cost per pack rather
than a treadmill.

---

## 2b. "No shim" — what it can and cannot mean

This is the decision that governs the whole programme, so it is worth being
precise. Two readings:

**(a) The converted artifact contains no compatibility layer.** It is genuinely
rewritten to the published API — not the old code wrapped in an adapter. ✅
**This is correct and should be the rule.** A wrapped artifact would preserve the
coupling we are trying to delete, and would have to be rewritten again later.

**(b) The host stops serving the legacy `window.comfyAPI` surface entirely.**
⚠️ This cannot happen on the timetable the conversion pipeline implies, for one
structural reason:

> **Not every installed pack is in the registry.** Git-URL installs, hand-dropped
> folders, private/in-house packs, and forks have no upstream entry and therefore
> no pre-computed artifact. The conversion DB can never reach them.

So a global switch-off breaks an unbounded, unmeasured set of working
installations. The realistic end state is:

|      | Converted pack         | Unconverted / unregistered pack |
| ---- | ---------------------- | ------------------------------- |
| API  | published surface only | legacy surface                  |
| Shim | **not used**           | still served                    |

The legacy surface stays _available_ while its _usage_ trends toward zero — and
because usage is now measurable, "can we delete it?" becomes a question with an
answer rather than a permanent no. That is the same argument as counting v1
imports in `docs/node_api_WIP.md` §2: **instrument first, delete when the data says so.**

Practical consequence: **conversion coverage, not conversion quality, is the
gating metric.** A perfect converter that reaches 60% of installs does not let us
delete anything.

### Closing the unregistered tail

Ranked by cost:

1. **Registry coverage** — most installs come from the registry; start there.
2. **Upstream PRs** (Sink A) — a merged conversion needs no artifact at all,
   because the published pack is already converted.
3. **Rules shipped to the client** — version-independent transforms can run
   locally on an unknown pack without any DB entry. Cheaper and safer than the
   agent, and covers the mechanical majority.
4. **On-device agent** — still deferred. Only worth it if 1–3 leave a
   user-visible gap.

Option 3 is the one that makes the tail tractable, and it is why the rule
catalog must be executable in the browser, not only in CI.

---

## 2c. What has to be true to flip a pack to "converted"

A per-pack gate, not a global one:

1. Its source hash matches an artifact, **or** client-side rules fully convert it.
2. The artifact declares an `apiMajor` this host serves.
3. Verification passed: zero attributable deprecation warnings, `graphToPrompt`
   byte-identical, no op-level regression (§5).
4. Delivery works for that pack — the unproven piece (§4).

Failing any of these, the pack loads unchanged, exactly as today. **The fallback
is always "behave like the current release",** which is what makes the feature
safe to enable by default later.

---

## 3. Step 2 — the `nodes_patches` manifest

Keyed by source-file hash, so a patch can never apply to a file it wasn't verified
against.

```jsonc
{
  "formatVersion": 1,
  "generatedAt": "2026-08-04T00:00:00Z",
  "harness": { "corpusLock": "<sha>", "matrixRun": "<ci-run-id>" },
  "patches": {
    "<sha256-of-original-file>": {
      "pack": "rgthree-comfy",
      "file": "web/comfyui/base_node.js",
      "packVersion": "1.2.3",
      "rules": ["type-write-noop"],
      "author": "rules", // or "agent:<model>" — recorded, then human-reviewed
      "verified": {
        "wireIdentical": true, // graphToPrompt byte-identical
        "warningsBefore": 12, // warnDeprecated fires, pre-patch baseline
        "warningsAfter": 0,
        "matrixVerdict": "SAME"
      },
      "patch": "<unified diff | full replacement text>"
    }
  }
}
```

Design notes:

- **Hash-keyed = exact.** No misapplication, no fuzzy matching, no "this looks like
  version 1.2." If the file differs by a byte, there is no patch and we serve the
  original. Fails safe by construction.
- **`verified` is carried in the artifact**, not just in CI logs. The client can
  refuse to apply a patch whose recorded `wireIdentical` is false, and a human
  reviewing the manifest sees the evidence inline.
- **`author` is recorded.** Agent-authored patches are distinguishable from
  rule-authored ones forever — for auditing, and for prioritising review.
- **Distribution:** bundle it with the frontend for the PoC. No network dependency,
  works offline, ships on the normal release train. Later, optionally fetch a fresher
  manifest with the bundled one as fallback.

### Hash-keyed patches are not the whole answer

The cost of exactness is coverage: **one patch covers exactly one version of one
file.** Packs update constantly — the study notes its own corpus drifts week to week
because packs are fetched from HEAD. Every pack release invalidates its patch.

So the manifest should carry **two kinds of entry**:

|                  | Keyed by  | Version-independent? | Use for                                                                            |
| ---------------- | --------- | -------------------- | ---------------------------------------------------------------------------------- |
| **Rule**         | pattern   | ✅ yes               | the mechanical majority — `type-write-noop`, `output.links` → `disconnectOutput()` |
| **Pinned patch** | file hash | ❌ no                | residue where the transform depends on surrounding control flow                    |

Rules survive pack updates and cover packs never seen in the corpus. Pinned patches
handle what rules can't express. Both are generated and verified by the same offline
job; only the key differs.

Getting the ratio right is the difference between a manifest that stabilises and one
that needs regenerating every week. **Push everything possible into rules.**

---

## 4. Step 3 — the client

Small, and the only part that lives in this repo's hot path:

```ts
// src/services/extensionService.ts:57 — the single interception point
const source = await (await fetch(api.fileURL(ext))).text()
const patch = manifest.lookup(sha256(source)) // + version-independent rules
await import(patch ? applyPatch(source, patch) : api.fileURL(ext))
```

Guarded by one setting, `!isCloud`, and `shouldLoadExtension()` (which already
excludes `extensions/core` and `extensions/cloud`, so first-party code is never
touched).

### The one genuinely hard part: delivery

`applyPatch` returns _text_, and the browser needs to _execute_ it. Three options,
and this is the main remaining engineering decision:

**A. Service worker intercept.** Register a SW that intercepts `/extensions/**`,
returns the patched body with `Content-Type: text/javascript`.

- ✅ **The URL is unchanged**, so relative specifiers (`./common.js`,
  `../../scripts/app.js`), `import.meta.url`, runtime asset loads, and stack traces
  all work natively. No rewriting, no link step, no module-graph analysis.
- ✅ Confirmed viable: SWs need HTTPS _or localhost_ — desktop is localhost.
- ⚠️ New moving part; there is no SW in this repo today (checked).
- ⚠️ Registration timing: a SW doesn't control the page on first load without
  `clients.claim()`. Needs `claim()` on activate plus awaiting readiness before
  `ComfyApp.setup()`. Feasible — extensions load late — but must be proven.
- ⚠️ SW cache staleness is a classic source of "why is my fix not applying."

**B. Blob URL + specifier rewriting.** Patch, rewrite every import specifier to
absolute, link the pack's module graph to sibling Blob URLs, `import()` that.

- ✅ No new platform machinery; entirely inside our one interception point.
- ❌ Blob URLs have no base URL, so **every relative specifier breaks** and we need a
  per-pack link step in dependency order, plus `import.meta.url` rewriting.
- ✅ Proven: `~/comfy/nodes-compat-study/compat/build_l2_fixture.py` does exactly this
  to load 1,801 packs' real JS in vitest. The specifier map is reusable.
- ❌ Degrades stack traces and debugging.

**C. Apply on disk at install time.** ComfyUI-Manager patches the file after
unpacking; everything downstream is unchanged.

- ✅ **By far the simplest runtime** — zero frontend involvement, normal static
  serving, correct URLs, correct everything.
- ❌ Mutates the user's installation. Reverting means reinstalling.
- ❌ Python-side, `Comfy-Org/ComfyUI-Manager` — out of this repo.
- ⚠️ Interacts with the manager's `.tracking` manifest: on version switch, files
  listed in `.tracking` are overwritten, so patches are silently reverted on update
  (arguably correct — the new version needs a new patch anyway).

**Recommendation: spike A, keep B as the fallback.** A is dramatically cleaner if
the registration timing works, and it eliminates the largest chunk of remaining
complexity — the module-graph link step — outright. C is worth raising with whoever
owns the manager, because it may simply be someone else's easier problem.

Why the constraint exists at all: `/userdata` accepts `.js` writes but can **never**
serve them as modules (`is_dangerous_content_type` forces `octet-stream` + `nosniff`

- `attachment`, `app/user_manager.py:345-361`), the desktop app exposes **zero**
  filesystem API (`~/comfy/desktop/src/preload.ts`), and no writable-and-served static
  directory exists (`server.py:1244`). Verified, not assumed.

---

## 5. Step 4 — the generation job

Runs in CI. This is where the AI lives, and where it can be held to account.

```
./run fetch --frozen            # pinned corpus, reproducible
      ↓
detect       rule detectors over source (census regexes, already validated on 4,969 packs)
      ↓
generate     Tier 1: deterministic rules
             Tier 2: agent, only for what Tier 1 declares unfixable
      ↓
verify       build_matrix.py + matrix_runner.ts, per pack, isolated
      ↓
gate         emit only patches that pass
```

### The gate

A patch ships iff, against a **pre-patch baseline on the same battery**:

1. `warnDeprecated` fires attributable to the pack drop to **zero** — this is the
   literal statement of the goal, and `LiteGraph.onDeprecationWarning` already
   stack-attributes warnings to the triggering pack file.
2. `graphToPrompt` output is **byte-identical**. Holds 1,801/1,801 today, making it
   an extremely sharp regression detector.
3. No op-level verdict regresses from `SAME` across the 20-op battery.

**The coverage trap, stated so we don't fall into it:** zero warnings can mean
"migrated" or "that path never executed" — indistinguishable from outside. So (1)
only counts against a baseline that was non-zero. A rule whose baseline is 0 needs a
targeted `PROBE`-style stimulus before its patch is trusted. The study hit exactly
this: it measured 0 deprecation warnings across the entire L2 run, and that was a
_coverage_ finding, not a clean bill of health.

### Why the agent is safe here

It cannot reach a user. Its output is a diff that must survive the matrix, then
human review before landing in the manifest. A hallucinated patch is a red build.

---

## 6. The real cost: the treadmill

Precomputed patches trade an on-device problem for a maintenance one. Being honest
about it:

- **Pack updates invalidate pinned patches.** Mitigated by pushing work into
  version-independent rules (§3), but not eliminated.
- **The corpus drifts.** `corpus.lock.json` + `./run fetch --frozen` make a run
  reproducible; keeping it _current_ is a recurring job.
- **Someone owns regeneration.** A scheduled CI job over the top-N packs by
  downloads, opening a PR when the manifest changes, is the minimum viable answer.
  19 packs cover 30% of affected installs — a small watched set covers most value.

**The metric that tells you it's working: the manifest should shrink over time.**
Which leads to the endgame.

---

## 7. Sink A — the upstream PR path

For registry packs whose author has ticked **"accepts upgrade PRs"**, the generator
opens a PR instead of (or as well as) shipping a manifest entry.

### Consent is the whole design

Auto-PRs without opt-in are spam at a scale that would poison the relationship with
the entire ecosystem — 697 unsolicited PRs from the platform vendor is not outreach,
it's a denial-of-service on maintainer attention. **The registry flag is not a
formality; it is the feature.**

Targeting is already solved: the registry has `repo` for all 4,984 packs, and
`results/affected_packs.csv` has publisher, repo, downloads and exact surfaces hit
for the 697 affected. What's missing is purely the consent field and the bot.

Suggested flag semantics — worth being precise, because "accepts upgrade PRs" is
ambiguous:

| Level           | Meaning                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| `off` (default) | Never open a PR. Manifest-only.                                           |
| `notify`        | Open an issue describing the needed migration, no code.                   |
| `pr`            | Open a PR with the upgraded code, author reviews and merges.              |
| `pr-automerge`  | For maintainers who want it hands-off. Probably out of scope for the PoC. |

Default must be `off`. Opt-in, never opt-out.

### The "new folder" detail is the crux, and it exposes a gap

The PR adds a **new JS folder with the upgraded code**, rather than rewriting the
existing one in place. That is the right call, and the reason matters:

> **Authors don't refuse to migrate because migration is hard. They refuse because
> migrating breaks their users on older frontends.** A pack that moves to the new
> API strands everyone who hasn't updated ComfyUI.

Shipping both directories removes that objection entirely — one release supports old
and new frontends. It's what makes the PR _mergeable_ rather than merely correct.

**But nothing in ComfyUI serves a second web directory today.** Both registration
paths bind exactly one:

```python
# nodes.py:2253-2266 — pyproject [tool.comfy] web
EXTENSION_WEB_DIRS[project_name] = web_dir_path
# nodes.py:2270-2273 — legacy WEB_DIRECTORY
EXTENSION_WEB_DIRS[module_name] = web_dir
```

So this path needs a **dual-web-dir convention** before any PR is worth sending:

- a new pyproject key (say `[tool.comfy] web-next = "web_v2"`),
- backend logic selecting it when the frontend advertises support,
- and a negotiation signal — frontend version is the obvious candidate, since
  `EXTENSION_WEB_DIRS` is populated at Python import time and the served frontend
  version is knowable there.

That is a **backend + registry change, not a frontend one**, and it gates Sink A
entirely. It should be scoped and owned before the bot is built — otherwise we
generate PRs that authors can't safely merge, which is worse than sending none.

Cheaper interim option: PR the migration in place, gated at runtime by a frontend
version check inside the pack's own JS. Uglier, no platform work, and it lets the
path be validated on a handful of friendly maintainers before committing to a
convention.

### Coverage — why Sink B never goes away

```
all installed custom nodes
 └─ in the registry (4,984)
     └─ affected (697)
         └─ author opted in  ← only these get Sink A
```

Every other branch — unregistered packs, git-URL installs, hand-dropped folders,
opted-out authors, abandoned packs, and any author who simply never responds — is
Sink B. Given that the #2 pack by downloads is in the affected set, Sink B is
carrying real weight regardless of how well the PR programme goes.

### The endgame

Intended lifecycle of a manifest entry:

```
detected → manifest entry → PR (if opted in) → merged → entry deleted
```

**The metric that says it's working is that the manifest shrinks.** If it only ever
grows, the migration isn't happening — it's being permanently papered over, and
we've recreated the compat-shim problem in a different file. Record upstream PR
status per entry from the start, so "how much of this is retired?" is a query and
not an archaeology exercise.

---

## 8. Milestones

1. **Publish the API** for the six migratable surfaces (§2). Precondition for
   everything else. Separately, decide the vue-only cohort's fate — that's the
   653-pack question.
2. **Delivery spike.** Service worker intercepting `/extensions/**`, proving
   registration lands before `ComfyApp.setup()`. Prove kjnodes (4.03M dl, 28 JS
   files) loads through it byte-equivalently, unpatched. _Highest remaining risk,
   and no AI in it._ Fall back to Blob URL + link step if timing can't be made safe.
3. **The flagship rule: `type-write-noop`.** Delete `this.type = this.type ?? undefined`
   — a defensive no-op. 11 packs by census, 8 confirmed by the matrix, 3.86M
   downloads, and it takes rgthree's entire 12-type virtual-node family from _fails
   to construct_ to _works_, by removing a line that was never trying to do
   anything. Smallest transform, largest payoff. **This is the demo.**
4. **Manifest format + client lookup + toast.** End-to-end with one rule.
5. **Generation job in CI**, rules only, gated on the matrix.
6. **Remaining in-scope rules**; measure coverage over the ~124-pack cohort.
7. **Agent tier in CI** for residue, human-reviewed before manifest inclusion.

Milestones 1–6 have no model anywhere. It is a real possible outcome that this ships
without one — the mappings are pre-documented (§2a), so the mechanical tier may cover
the in-scope cohort outright. The ordering is designed to discover that early.

**Sink A runs on a parallel track, and is not on the PoC critical path:**

|     |                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Scope the dual-web-dir convention (backend + registry). **Gates everything else here.**                                                            |
| A2  | Add the registry consent flag, default `off`                                                                                                       |
| A3  | PR bot, seeded from `affected_packs.csv`, opted-in authors only                                                                                    |
| A4  | Hand-run milestone 3's patch as a manual PR to 2–3 friendly maintainers first — validate that the artifact is actually mergeable before automating |

A4 before A3 is deliberate. The failure mode of a PR bot is reputational and hard to
walk back; the failure mode of three hand-sent PRs is an awkward conversation.

---

## 9. Open questions

- **Q1 (blocking).** Does the service worker register reliably before extension
  import, on cold start, in Electron and in a browser? If not, fall back to B.
- **Q2 (product, highest leverage).** Is the vue-only cohort in or out? That's the
  653-pack / 35%-of-installs decision, and it's an API commitment, not a patching
  question.
- **Q3.** Manifest distribution — bundled only, or fetchable? Bundled is simpler and
  offline-safe; fetchable is fresher but adds a trust boundary and a network
  dependency.
- **Q4.** Do we patch a pack the user has hand-modified? Hash-keying makes this
  automatic — a modified file has a different hash, so no patch applies. That's
  probably the correct behaviour for free; worth confirming it's intended.
- **Q5.** Pack identity is ambiguous: `EXTENSION_WEB_DIRS` is keyed by pyproject
  `project.name` _or_ directory basename, and both can exist for one pack
  (`nodes.py:2253-2273`). Hash-keying sidesteps this for lookup, but manifest
  metadata and reporting still need a canonical name.
- **Q6.** Where does the manifest live — this repo, or alongside the study? It's a
  data artifact with a different release cadence than the frontend.
- **Q7 (gates Sink A).** Who owns the dual-web-dir convention? It's backend +
  registry work, and no upgrade PR is safely mergeable without it. Is there appetite
  for a `[tool.comfy] web-next` key and frontend-version negotiation, or do we start
  with in-pack runtime version checks?
- **Q8.** If a pack merges our PR, its file hashes change and its manifest entries go
  dead automatically — correct behaviour, but it means Sink A silently retires Sink B
  entries only if we regenerate. Does the scheduled job re-detect merged upstreams, or
  do we track PR state explicitly? Explicit tracking is more work but makes the
  "is it shrinking?" metric trustworthy.

---

## 10. Sink C — the replacement-node mapping

A third output, and strategically the strongest one: for custom nodes that duplicate
something ComfyUI now ships natively, **don't patch them — replace them.**

```jsonc
// replacement_nodes.json — keyed by node type, not file hash
{
  "formatVersion": 1,
  "replacements": {
    "KJNodes.ImageResizeKJ": {
      "replaceWith": "ImageScale",
      "confidence": "exact", // exact | lossy | suggest-only
      "inputs": { "image": "image" },
      "widgets": {
        "width": "width",
        "height": "height",
        "upscale_method": {
          "map": { "lanczos": "lanczos", "bicubic": "bicubic" }
        }
      },
      "outputs": { "IMAGE": "IMAGE" },
      "appliesWhen": "widgets.keep_proportion === false", // predicate; else don't offer
      "verified": { "outputsMatch": true, "harnessRun": "<ci-run-id>" }
    }
  }
}
```

### Why this is different from Sinks A and B

Source patches preserve the dependency; this **retires** it. A workflow whose custom
nodes have all been substituted no longer needs the pack installed at all — which
removes it from the migration problem permanently, not until the next pack release.
It's the only sink whose entries can never go stale.

It is also the one that should probably **not** be AI-generated. The mapping is a
curated table: a human decides "this node is the same as that node," and the value
is entirely in that judgment being correct. An LLM could _propose_ candidates by
similarity, but a wrong entry here silently changes what a user's workflow produces.

### The line I'd draw: this one is not silent

Everywhere else in this design, silent is right — patching JS to use a supported API
is invisible by construction, and the wire format is byte-identical by gate (§5).

Substitution is categorically different. It **changes the user's workflow document**.
Even an exact-equivalence mapping alters what's saved, what's shared, and what runs.
Doing that silently would be the one genuinely user-hostile thing in this document.

Suggested behaviour by confidence:

| Confidence     | Behaviour                                          |
| -------------- | -------------------------------------------------- |
| `exact`        | Offer, one click, undoable. Still not automatic.   |
| `lossy`        | Offer with an explicit diff of what changes        |
| `suggest-only` | Surface in a "this pack may be unnecessary" report |

The natural trigger is the **missing-node dialog** — a user opening a workflow whose
pack isn't installed currently gets a dead end; offering a native substitution there
is pure upside and requires no opt-in reasoning at all.

### Mechanism

Graph rewrite, not source rewrite, so it flows through the command pattern per
ADR 0003/0008 — serializable, idempotent, undoable. That's the correct substrate and
it gives undo for free, which matters a great deal for a transform that edits user
documents.

```ts
type PatchArtifact =
  | { kind: 'source'; patch: string } // Sinks A/B
  | { kind: 'graph-rewrite'; operations: LayoutOperation[] } // Sink C
```

### Verification

Different gate from §5, because the invariant is different. Source patches must keep
`graphToPrompt` **byte-identical**; a substitution deliberately changes it. So the
gate becomes: **execute both graphs and compare outputs.** That is L4 — explicitly
out of scope for the compat study by decision, and a genuinely harder harness
(needs models, a backend, determinism control via fixed seeds).

Which is the honest reason this ships last: _we don't currently have a way to prove a
substitution is correct._ Until we do, `exact` is a human claim, not a measured one —
so keep the confidence field, keep it user-confirmed, and don't let it go silent.

---

## 11. Explicitly deferred

**On-device agent** for packs with no manifest entry. If the offline pipeline works,
the marginal case is a pack nobody has seen — better served by adding it to the
corpus than by shipping an LLM to every desktop.

---

## Appendix — source references

| Topic                                       | Location                                                                                                                               |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Interception point + core filter            | `src/services/extensionService.ts:23,49-67`                                                                                            |
| Extension list (recursive `**/*.js`)        | `server.py:356-368`                                                                                                                    |
| Static mount, `text/javascript`, `no-store` | `server.py:1244`, `middleware/cache_middleware.py:34`                                                                                  |
| userdata mime block (why not C2)            | `app/user_manager.py:345-361`, `folder_paths.py:279-306`                                                                               |
| No desktop FS API                           | `~/comfy/desktop/src/preload.ts`                                                                                                       |
| Deprecation fan-out hook                    | `src/lib/litegraph/src/utils/feedback.ts:13`                                                                                           |
| Deleted link mirrors + replacement APIs     | `NodeInputSlot.ts:23-40`, `NodeOutputSlot.ts:26-44`, `node/slotLinks.ts:11-81`                                                         |
| Closed Vue widget table                     | `widgetRegistry.ts:272-288`                                                                                                            |
| `.tracking` manifest (option C)             | `manager_core.py:1286-1334`                                                                                                            |
| Census + corpus + matrix                    | `~/comfy/nodes-compat-study/` — `docs/REPORT.md`, `results/registry_scan.json`, `results/affected_packs.csv`, `compat/build_matrix.py` |
| Specifier-rewriting precedent (option B)    | `~/comfy/nodes-compat-study/compat/build_l2_fixture.py`                                                                                |
| ECS charter                                 | `docs/adr/0008-entity-component-system.md`                                                                                             |
