# ADR-EXTENSION-LOADING-0048: Late custom nodes turn on after the editor opens

Date: 2026-10-24

## Status

Proposed

## Context

The editor imports every custom node script before it opens. On a deployment
the scripts are served by a CPU server that may still be starting, so one slow
pack keeps the whole editor behind the startup spinner for as long as that
server takes, often 20 s or more. Most of the editor does not need custom
nodes to be usable: the artist can look at the workflow, pan, and edit core
nodes while the packs arrive.

An extension's startup steps (`init`, `registerCustomNodes`, node definition
registration, `setup`) normally run once, inside `app.setup()`, for every
extension registered before it. A script that registers after that point gets
none of them, so it cannot simply be registered whenever it arrives.

## Decision

Behind the `late_custom_nodes_enabled` flag, and only when the page may boot on
a deployment (`couldBootOnDeployment()`), startup waits 2 s for the custom node
scripts and then stops waiting.

1. **Hold.** From then on the extension service does not register new
   extensions; the extension store holds them, in registration order, as one
   discriminated-union state (`immediate`, `holding` with the held list, or
   `starting` while the held extensions run their startup steps).
   A held extension whose disposer runs is dropped.
2. **One batch.** Once every script has settled, the startup spinner is gone,
   and the artist is not holding the pointer down or typing in a text field
   (at most 30 s), holding stops and the held extensions are registered. Their
   `init` runs, node definitions are fetched again and every extension's
   `addCustomNodeDefs` gets them (so caches such as the group node's see the
   new types), the held extensions' `registerCustomNodes` runs, then those
   definitions are registered again so every extension's per-definition hooks
   see the new types, then the held extensions' `setup` runs. When that fetch
   fails it is reported, and `registerCustomNodes` and `setup` still run; the
   next definitions fetched by a successful refresh go through every
   extension's `addCustomNodeDefs` first, so the types an extension adds there
   register then.
3. **Rebuild.** The open workflow is rebuilt once so every extension's per-node
   functions run on its nodes, even when no late extension arrived. The rebuild keeps the saved baseline and the
   unsaved mark, and adds no undo entry.
4. **Missing nodes wait.** While holding, and until the held extensions'
   startup steps finish, a node type missing from the open workflow is not
   reported missing; the rebuild after them reports what is still missing.
5. **Failures are reported.** A script that failed is reported with the other
   load failures; an extension that cannot register or whose startup step
   throws is reported through `reportError`, and the rest of the batch goes on.
6. **Lifetime.** The work belongs to the canvas that started it: when it
   unmounts, the batch stops, the held extensions are registered without their
   startup steps and later ones register as before, so the next canvas's
   startup runs them, as it would without this change.

With the flag off, or on Comfy Cloud where no deployment can be booted,
startup waits for every script as before.

## Consequences

- The editor opens about 2 s after the core extensions on a deployment with a
  slow CPU server, instead of after the slowest pack.
- A late extension's startup steps run in a different order relative to the
  other extensions' than they would at startup: after every early extension's
  `setup`, and after the first workflow was loaded. A pack that assumes it ran
  before the first graph load sees that load again through the rebuild.
- The artist sees the workflow before its custom nodes work. Telling them so
  (a starting toast, a waiting look on the nodes) is separate work on top of
  this change.

## Alternatives considered

- **Keep waiting for every script.** Correct, but keeps the spinner up for as
  long as the slowest pack takes.
- **Register a late extension as soon as it arrives and replay its hooks one
  by one.** Each arrival would reload node definitions and rebuild the
  workflow, so a workflow with several late packs would rebuild several times
  under the artist.
- **Reload the page once every script has arrived.** Loses the artist's view
  and anything they changed since the editor opened.
