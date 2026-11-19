# ADR-AGENT-ATTACHMENTS-0059: Lift embedded workflows in the composer

Date: 2026-11-19

## Status

Accepted. The behaviour below is implemented by
[#23804](https://github.com/Comfy-Org/ComfyUI_frontend/pull/23804) and does not
describe `main` until that lands. Nothing on the attach path calls the metadata
parsers before it; today they serve the asset menus, linear preview and the
assets sidebar through `workflowExtractionUtil`.

## Context

Attaching an image that carries ComfyUI workflow metadata gave the agent a
picture and nothing else. The agent's workflow tools only reach a graph that
arrived as its own attachment, so the only way to hand one over was to drop the
image on the canvas first and let it open there — which is what we were telling
users to do as a workaround.

Cloud already imports a hand-attached `.json`: its reader resolves the
attachment in the caller's scope, validates ComfyUI save format, and seeds a
version-less draft that `read_workflow` and the edit tools operate on, without
touching the canvas. That path accepts `.json` only, and that single predicate
was the whole gap.

Four placements were considered.

**A runtime-side reader in Go.** The runtime owns the import seam, the asset
byte-fetch seam for both Cloud and local, and `ffprobe`. It is also the only
placement that could serve a model-callable tool, a library asset the browser
never held, or a headless surface. Its container layer would largely exist
already: `common/assets/location_strip.go` walks PNG chunks, WebP RIFF, JPEG
segments and TIFF IFDs under a fuzz harness.

**A published `@comfyorg/workflow-metadata` package consumed by the runtime.**
Not possible — Go cannot consume a published npm package. Worth doing on its own
merits for JS/TS consumers, but it is not a route to sharing this logic.

**One implementation compiled to WASM.** The only true single-implementation
answer, paid for in bundle size, build complexity, and replacing a working
frontend path.

**`comfy workflow extract` in comfy-cli as a shared subprocess.** The runtime
already shells out to comfy-cli for every workflow operation, so the plumbing
exists, but comfy-cli explicitly declined this scope in
[comfy-cli#341](https://github.com/Comfy-Org/comfy-cli/issues/341).

Two measurements shaped the choice. Embedded workflow metadata **survives
upload**: the ingest location stripper rewrites container bytes to remove GPS
and XMP while preserving ComfyUI's `workflow`/`prompt` byte-for-byte, with CI
tests asserting it on the stored object. And `ffprobe` is **blind to still
images** — it surfaces the tags for mp4, webm, flac, mp3 and opus, and nothing
at all for png, webp or avif — so it would not have helped the common case.

## Decision

Lift the workflow in the composer, and hand it to the existing backend import
path as a derived `.json` attachment. No backend change.

On attach, the metadata parsers already in `src/scripts/metadata/` will read the
container. Where it yields an editor-format `workflow`, that workflow is to be
staged beside the image as its own visible, removable attachment chip and
uploaded through the same endpoint every attachment uses. Cloud's reader then
treats it as an ordinary attached workflow file.

The scope is deliberately narrower than placement A: **no model-callable tool.**
The agent sees embedded workflows only from assets attached in the browser.

Three constraints the implementation is bound by:

- **Derivation runs after its sources finish uploading**, never from inside the
  upload itself. Deriving there would have each upload wait on a concurrency
  slot while holding one, deadlocking as soon as `MAX_CONCURRENT_UPLOADS`
  workflow-bearing images are attached together.
- **The derived file is named like a filename**, not a translated label.
  `src/locales/en/main.json` is deliberately unowned and shared by every
  feature, so a key there would move this change outside the Agent-owned paths.
- **Every failure is silent.** The image must still attach, so derivation can
  never be the reason an attachment fails.

An API-format `prompt` with no editor graph is left alone. Offering the lossy
re-derived graph is [BE-4259](https://linear.app/comfyorg/issue/BE-4259), which
carries a recorded decision that it needs product sign-off first: a re-derived
graph has invented layout and no groups or reroutes, and substituting it
silently is the wrong fix.

## Consequences

The feature ships without backend work, and there is one parser rather than two,
so there is no cross-language conformance problem to maintain.

The cost is the boundary. Nothing reaches an embedded workflow unless a browser
held the bytes: not a tool call, not a library asset the agent found on its own,
not a headless or MCP surface. Closing that needs the runtime-side reader this
ADR declines to build, and that work would then need a shared fixture corpus to
keep the two implementations honest.

Two smaller consequences. A derived `.json` is stored as an input asset, so it
appears in the Assets tab; a `derived` tag and a filter are the follow-up if
that becomes annoying. And a workflow-bearing image consumes two of the
twenty-five per-turn attachment slots instead of one — when the turn is already
full the lifted workflow is dropped silently rather than raising an error the
user cannot act on.

Because an attached workflow becomes the turn target, except where an
explicitly selected unbound or unsaved tab takes precedence, attaching a
workflow-bearing image usually retargets the turn away from the active canvas.
The exception is backend policy from
[cloud#17623](https://github.com/Comfy-Org/cloud/pull/17623), where
`unboundTargetSelected` skips attachment inspection, and this decision does not
override it. That is
why the derived chip is visible and removable: the retarget follows something
the user can see and undo, rather than a silent inference. `zTXt` remains
unhandled, as it already was — a workflow written that way is invisible to the
frontend's own canvas drop path too.
