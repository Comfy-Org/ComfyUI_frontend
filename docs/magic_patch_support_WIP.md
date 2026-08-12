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

## Backend routes: two verification items that need a real install

Both were found by comparing each converted file against its original, and
neither can be settled from the frontend repo alone. They need one run against
a real ComfyUI with the pack installed.

### 1. Does `/api`-prefixing a custom node's own route still reach it?

`comfy.backend.url()` and `comfy.backend.fetch()` both go through
`api.apiURL()`, which prepends `/api`. Core routes are served at both `/x` and
`/api/x`, so this is invisible for them. Custom nodes register their routes on
the same aiohttp app, and whether those are _also_ dual-mounted decides whether
a converted call reaches the pack's own backend or 404s.

Two independent signals say it may not:

- rgthree serves `/rgthree/api/…` and the original **monkeypatched
  `api.apiURL`** so its own routes bypass the prefix.
- `Comfyui_LG_Tools/web/image_selector.js` originally sent a bare
  `fetch('/image_selector/select')`; an early conversion round wrapped it in
  `comfy.backend.url()`, adding a prefix the pack never sent.

Routes to try, one request each — a 404 answers it:

    /image_selector/select      /party/workflow_list      /ollama/get_models
    /kaytool/clean_vram         /deno/local_llm/models    /alekpet/remove_node_settings

If they 404 under `/api`, the fix is guidance, not API: a bare root-relative
`fetch()` in the original stays a bare `fetch()`. Only an original
`api.fetchApi` call becomes `comfy.backend.fetch`. If a pack genuinely needs an
_authenticated_ call to a non-`/api` route, that is a real gap and needs a
host-rooted authenticated fetch — the `fetch` counterpart to `assetUrl`.

### 2. Fourteen converted files dropped authentication

The original called `api.fetchApi`; the conversion calls bare `fetch`. On a
local install this is invisible. On a hosted one every such call is a 401 —
these do not fail loudly, they fail as an empty list or a silent no-op.

    bjornulf_custom_nodes/web/js/ollama_talk.js
    ComfyUI-Impact-Pack/js/{impact-image-util,impact-pack,impact-sam-editor,impact-segs-picker}.js
    ComfyUI-Lora-Auto-Trigger-Words/web/js/betterCombos.js
    ComfyUI-Lora-Manager/web/comfyui/{autocomplete,loras_widget_events,preview_tooltip,trigger_word_highlight,usage_stats}.js
    ComfyUI_Fill-Nodes/web/FL_SystemCheck.js
    ComfyUI_LayerStyle/js/dz_mtb_widgets.js
    ComfyUI-Prompt-Assistant/js/node/captionFrame.js

None carried an `API-GAP:` marker, so no report mentioned them — the marker
tally does not see a regression nobody wrote down. Re-run the sweep in
`scripts/magic-patch/verify/` after fixing.
