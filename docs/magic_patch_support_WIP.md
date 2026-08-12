> # ⚠ WORK IN PROGRESS — SHOULD NOT BE SUBMITTED TO MAIN
>
> Companion to `magic_patch_WIP.md`, `node_api_WIP.md` and
> `API_DECISIONS_FOR_REVIEW.md`.

# Magic Patch — support status

What we claim to support, what we knowingly do not, and what is still unproven.
Written to be read before hands-on testing, so that behaviour we already
decided to drop is not re-reported as a defect.

## What the statuses mean

A file is **converted** when it was rewritten onto the published node API. It is
**refused** when the conversion was impossible and the whole file was replaced
with an `// API-GAP:` block naming what is missing — an honest refusal, not a
silent half-rewrite. A pack is:

| status             | meaning                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| **full**           | every in-scope file converted, nothing refused                                                  |
| **partial**        | converted, with a minority of files refused — the pack loads and mostly works                   |
| **mostly refused** | more files refused than converted — the node types still run, but much of the pack's UI is gone |
| **INCOMPLETE**     | files remain untouched; not ready to assess                                                     |

"Full" is a statement about _disposition_, not about proven behaviour. See
§Unproven.

## Coverage

Measured against the top 135 packs, which are ~80% of all downloads:

|                                   |  downloads |             share |
| --------------------------------- | ---------: | ----------------: |
| ship no JavaScript — need nothing | 35,097,791 |             41.2% |
| ship JS — need work               | 50,147,687 |             58.8% |
| ↳ in a fully-converted pack       | 36,995,003 | 73.8% of the work |
| ↳ partially converted             | 10,549,060 |             21.0% |
| ↳ never touched                   |  2,603,624 |              5.2% |

**84.6% of top-135 downloads either need nothing or sit in a fully-converted
pack.** 504 of 530 in-scope files are done (95.1%); 52 of 61 packs complete.

Two numbers that qualify that headline:

- **19% of touched files are refusals** (101 of 535), and they are concentrated.
  rgthree counts as covered on downloads while 32 of its 48 files are refused.
- **5.8% of downloads are unreachable in principle** — packs whose served
  frontend is minified build output with no source in the distribution
  (`comfyui-easy-use` is the confirmed case; its `__init__.py` serves
  `web_version/v2`, the build artifact of a separate repo). Those need an
  upstream PR, not a patch.

## Per-pack status

| pack                            | downloads | converted | refused | left | status         | on test box |
| ------------------------------- | --------: | --------: | ------: | ---: | -------------- | ----------- |
| comfyui-kjnodes                 | 4,039,686 |        25 |       0 |    0 | full           | yes         |
| rgthree-comfy                   | 3,692,630 |        15 |      32 |    1 | INCOMPLETE     | yes         |
| comfyui-easy-use                | 3,301,869 |        12 |      10 |    2 | INCOMPLETE     |             |
| comfyui-videohelpersuite        | 3,176,624 |         3 |       0 |    0 | full           | yes         |
| comfyui-impact-pack             | 3,141,920 |         7 |       0 |    0 | full           |             |
| comfyui_essentials              | 2,794,415 |         2 |       0 |    0 | full           | yes         |
| comfyui-custom-scripts          | 2,760,706 |        23 |       7 |    0 | partial        | yes         |
| ComfyUI-Crystools               | 2,095,275 |         5 |       0 |    0 | full           | yes         |
| comfyui_layerstyle              | 1,986,588 |         2 |       1 |    0 | partial        |             |
| cg-use-everywhere               | 1,889,056 |         2 |       0 |   12 | INCOMPLETE     |             |
| comfyui-mxtoolkit               | 1,089,798 |         5 |       0 |    0 | full           | yes         |
| efficiency-nodes-comfyui        | 1,020,005 |         7 |       9 |    0 | mostly refused | yes         |
| comfy-mtb                       |   908,221 |         7 |       2 |    0 | partial        |             |
| comfyui-image-saver             |   858,668 |         1 |       0 |    0 | full           |             |
| comfyui-inspire-pack            |   851,413 |         7 |       0 |    0 | full           |             |
| comfyui-art-venture             |   842,381 |         3 |       0 |    0 | full           |             |
| comfyui-inpaint-cropandstitch   |   826,424 |         1 |       0 |    0 | full           |             |
| comfyui-rmbg                    |   809,573 |         2 |       0 |    0 | full           |             |
| comfyui-lora-manager            |   712,614 |        18 |       2 |    2 | INCOMPLETE     |             |
| derfuu_comfyui_moddednodes      |   697,415 |         1 |       0 |    0 | full           |             |
| controlaltai-nodes              |   611,357 |         1 |       0 |    0 | full           |             |
| comfyui_tinyterranodes          |   574,205 |         7 |       2 |    0 | partial        |             |
| comfyui-mixlab-nodes            |   573,364 |        17 |       3 |    0 | partial        |             |
| comfyui-wd14-tagger             |   557,854 |         1 |       0 |    0 | full           |             |
| comfyui_custom_nodes_alekpet    |   535,919 |         9 |       1 |    0 | partial        |             |
| comfyui_fill-nodes              |   455,168 |        38 |       5 |    0 | partial        |             |
| comfyui-ollama                  |   434,727 |         1 |       0 |    0 | full           |             |
| ComfyUI-QwenVL                  |   383,199 |         1 |       0 |    0 | full           |             |
| comfyui_ttp_toolset             |   378,616 |         1 |       0 |    0 | full           |             |
| comfyui-jakeupgrade             |   373,287 |         2 |       0 |    0 | full           |             |
| crt-nodes                       |   330,138 |        20 |       3 |    0 | partial        |             |
| Comfyui-Resolution-Master       |   277,504 |         2 |       0 |    4 | INCOMPLETE     |             |
| bjornulf_custom_nodes           |   251,260 |        42 |       0 |    1 | INCOMPLETE     |             |
| deno-custom-nodes               |   240,294 |        16 |       3 |    0 | partial        |             |
| basic_data_handling             |   213,497 |         0 |       1 |    0 | mostly refused |             |
| comfyui-get-meta                |   202,731 |         2 |       0 |    0 | full           |             |
| comfyui-tooling-nodes           |   195,154 |         1 |       0 |    0 | full           |             |
| aigodlike-comfyui-translation   |   191,901 |         2 |       0 |    0 | full           |             |
| cg-image-filter                 |   188,962 |         4 |       0 |    0 | full           |             |
| LanPaint                        |   177,770 |         1 |       0 |    0 | full           |             |
| promptmodels                    |   174,322 |         2 |       0 |    0 | full           |             |
| comfyui-workflow-encrypt        |   168,678 |         1 |       0 |    0 | full           |             |
| ComfyUI_LayerStyle_Advance      |   166,160 |         1 |       0 |    0 | full           |             |
| comfyui-ppm                     |   165,286 |         2 |       0 |    0 | full           |             |
| ComfyUI-3D-Pack                 |   157,754 |         1 |       0 |    0 | full           |             |
| comfyui-utils-nodes             |   148,199 |         1 |       0 |    0 | full           |             |
| comfyui-lora-auto-trigger-words |   147,304 |         0 |       1 |    0 | mostly refused |             |
| comfyui-enricos-nodes           |   143,251 |         4 |       0 |    1 | INCOMPLETE     |             |
| ComfyUI-Copilot                 |   141,023 |         1 |       0 |    1 | INCOMPLETE     |             |
| prompt-assistant                |   139,853 |         5 |       6 |    2 | INCOMPLETE     |             |
| tts_audio_suite                 |   137,017 |        25 |       2 |    0 | partial        |             |
| comfyui_smznodes                |   136,323 |         0 |       2 |    0 | mostly refused |             |
| wan22fmlf                       |   131,486 |         1 |       0 |    0 | full           |             |
| comfyui_lg_tools                |   129,872 |        18 |       3 |    0 | partial        |             |
| comfyui_llm_party               |   126,144 |         3 |       0 |    0 | full           |             |
| kaytool                         |   122,365 |        13 |       1 |    0 | partial        |             |
| save-image-extended-comfyui     |   122,290 |         2 |       0 |    0 | full           |             |
| comfyui-qwenmultiangle          |   113,100 |         1 |       0 |    0 | full           |             |
| comfyui_essentials_mb           |   112,891 |         2 |       0 |    0 | full           |             |
| comfyui-prompt-reader-node      |   110,389 |         6 |       0 |    0 | full           |             |
| comfyui-quadmoons-nodes         |   108,168 |         3 |       0 |    0 | full           |             |

## The test box

`http://127.0.0.1:8189` — ComfyUI running against
`comfyui-frontend-2/dist`, with **1344 node types**, 518 from custom packs, 481
of those from converted packs. Eight converted packs are installed, each with
its upstream Python and our converted JS overlaid on top:

kjnodes · essentials · VideoHelperSuite · efficiency-nodes · Crystools ·
rgthree · Custom-Scripts · mxToolkit

Reinstall or add more with `sh scripts/magic-patch/verify/install_converted.sh <pack>`. It
clones upstream, syntax-checks every converted file as ESM, then overlays only
files the pack actually ships. ComfyUI must be started from its venv
(`.venv/bin/python`) — the bare Homebrew interpreter is missing the deps.

## Known losses — please do NOT report these as bugs

These are decisions, recorded here so testing spends its time on the unknown.

**rgthree** — the largest deliberate loss in the set. Every rgthree _frontend_
node is gone: Reroute, Label, Bookmark, Fast Muter, Fast Bypasser, Fast Groups
Muter/Bypasser, Fast Actions Button, Node Collector, Mute/Bypass Repeater and
Relay, Random Unmuter. Its overrides on backend nodes are gone too — Seed,
Context (all variants), Any Switch, Image Comparer, Power Primitive, Power
Puter, Power Lora Loader, Power Prompt. The backend node types still exist and
still execute; they simply have no rgthree UI. Also gone: the progress bar, the
settings dialog, top-bar buttons, the rgthree canvas menu, and `window.rgthree`.
Two consequences worth knowing while testing: **Seed no longer holds its `-1`
sentinel**, so a re-run randomises; and **Context no longer migrates its slots**,
so an old Context workflow can land links on the wrong slot.

**Custom-Scripts (pysssss)** — autocomplete is gone entirely (embeddings, LoRA
tags, custom word list). Workflow management (server-side save/load, default
workflow, "send to workflow") is gone. Workflow image export/import including
SVG is gone. Reroute/MultiPrimitive retyping and permutation are gone. The image
feed still works, but the 🖼️ button is gone — show it via the command
`pysssss.ImageFeed.Show`. The `pysssss.updateExamples` bridge is gone, so the
example list refreshes on the next model change rather than immediately.

**efficiency-nodes** — the entire right-click node menu is gone (Swap-with ×4,
Add-link, Add-script, Add-XY-input, Set-Resolution, View-model-info,
Seed-behavior); that is roughly half the pack's UI. The seed control button is
gone.

**Everywhere** — anything that needed to change a value _at prompt time_, or to
queue a prompt itself, is inert. That is one root cause (no prompt-time value
substitution, no queueing) behind most individual losses above.

## What is NOT proven

Be appropriately sceptical of everything above.

- **Nothing has been exercised in a browser.** Every wire-format claim is read
  off `LGraphNode.serialize`/`configure` and `executionUtil`, not observed. The
  single most valuable thing this testing can produce is a save → reload →
  queue round trip on a real workflow per pack.
- **The conformance checker passing is not the same as the file running.** Three
  conversions were found referencing identifiers that no longer existed —
  syntactically valid, clean under every syntax check, dead on load. They are
  now caught by `scripts/magic-patch/verify/undef.sh` (ESLint `no-undef`, diffed against the
  original to subtract each pack's pre-existing globals), but the class is a
  reminder that static gates have a ceiling.
- **Only 8 of 52 completed packs are installed here.** The rest are converted
  and verified statically, and have never been loaded.
- Current gate state: 496 conformance pass, 3 sanctioned hold-outs, 11 fail —
  of the failures, 6 are an advisory line-growth heuristic, 2 are a verified
  false positive on lora-manager's own widget facade, 1 is three.js inside a
  build artifact, 1 is mixlab's `graph._nodes` (genuinely outstanding).

## Backend routes: resolved

Both items previously listed here are closed, and neither needs a backend run
any more.

**Routes are no longer changed by conversion.** Six files had a bare
root-relative request wrapped in `comfy.backend.url()`, which both adds an
`/api` prefix the pack never sent and drops credentials. Those call sites now
match their originals exactly, so whether ComfyUI dual-mounts a custom node's
routes no longer affects anything in the corpus. The rule the conversions
follow:

- original `api.fetchApi(r)` → `comfy.backend.fetch(r)`
- original bare `fetch(r)` → **stays** a bare `fetch(r)`, including when that
  is the author's own bug
- original `fetch(api.apiURL(r))` → `fetch(comfy.backend.url(r))`, unchanged

**Authentication is restored.** 14 files had `api.fetchApi` downgraded to a
bare `fetch` — invisible locally, a 401 on every hosted install, failing as an
empty list rather than an error. All are fixed, with every route verified
byte-identical to its original.

`scripts/magic-patch/verify/regressions.mjs` now reports zero in all three
classes and is the gate that keeps it that way. It compares route _sets_
rather than counting calls, and excludes anything the original already did, so
a pack keeps its own pre-existing bugs and only conversion-introduced ones are
reported.
