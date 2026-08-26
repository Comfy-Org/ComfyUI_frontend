# Node API V2 review follow-up: proposed changes

Status: proposal after the August 25, 2026 API review. API names marked
“illustrative” are not final.

This document translates the feedback in
[Custom Nodes API V2 Decisions for Review — Frontend Graph API](https://app.notion.com/p/3b86d73d36508161b845e6bc870d8d91)
into concrete changes to the proposed API. It intentionally keeps the original
1–18 numbering so every change can be traced back to the question that caused
it. The conversion evidence behind the review remains in
[API_DECISIONS_FOR_REVIEW.md](./API_DECISIONS_FOR_REVIEW.md).

The review meeting is available in the
[August 25 recording](https://app.fireflies.ai/view/01M0WZBFGEBSADKZJ5PXPJX4KV).

## Reading this proposal

- **Add** means a new public capability or authoring shape.
- **Change** means an implemented V2 surface should change before it is frozen.
- **Keep** means the meeting accepted the existing public behavior.
- **Audit** means the author-facing shape can remain only if the implementation
  proves the stated invariant.
- **Later** means the idea is useful but is not part of the first V2 release.
- **Additive** means existing converted source remains valid and the new shape
  is optional.
- **Source-compatible behavior** means no authoring syntax changes, but the
  affected behavior must be retested.
- **Conditional** means pack source changes are required only if the final
  design removes or narrows an existing call.
- **Secure-runtime impact** separately describes what changes when the same
  source runs in an isolated worker rather than the host page.

Every public type change requires regenerating and redistributing the generated
`comfy-api.d.ts` to all 61 supported packs. That automated declaration refresh
is not counted as a pack source migration below.

| §   | Result | API compatibility             | In-process V2 source impact                    | Proposed response                                                  |
| --- | ------ | ----------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Change | Source-compatible policy      | None                                           | Report V2, define phased deprecation, retain capability checks     |
| 2   | Keep   | No surface change             | None; rerun wire gates                         | Preserve first-release workflow and prompt bytes                   |
| 3   | Audit  | Source-compatible if retained | None; retest graph mutations                   | Prove every mutation reaches commands, undo and collaboration      |
| 4   | Keep   | No surface change             | None; rerun prompt gates                       | Retain pure, synchronous, graph-local resolution and supply        |
| 5   | Change | Additive compatibility path   | None required; 7 packs may adopt it            | Add owner-aware namespacing; keep diagnosed LWW as fallback        |
| 6   | Keep   | No surface change             | None; retest committing writes                 | Keep one committing `setValue()` operation                         |
| 7   | Change | Additive compatibility path   | None; retest current adapters across 21 packs  | Separate preparation, validation, observation and global authority |
| 8   | Change | Source-compatible behavior    | None; retest order-sensitive behavior          | Establish one install order and per-event merge rules              |
| 9   | Keep   | No surface change             | None; retest 4 workflow-opening packs          | Retain explicit workflow opening and namespaced pack data          |
| 10  | Change | Additive compatibility path   | None required; 32 packs may adopt it           | Reserve host IDs and add a host-bound pack namespace               |
| 11  | Audit  | Source-compatible if retained | None; retest geometry reads across 16 packs    | Prefer intent APIs; retain proven geometry reads                   |
| 12  | Change | Additive/host behavior        | None                                           | Keep typed UI and visibly attribute pack contributions             |
| 13  | Change | Additive                      | None required; 1 pack may adopt scoped storage | Add storage ownership, quota and cleanup policy                    |
| 14  | Add    | Additive                      | None required; lifecycle scans may migrate     | Register filtered widget behavior instead of scanning `onCreated`  |
| 15  | Add    | Additive                      | None required; 3 packs may adopt it            | Target host multiline editors through widget extensions            |
| 16  | Audit  | No required surface change    | None; retest the 4-pack routing/drop cohort    | Retain behavior callbacks; add only proven semantic helpers        |
| 17  | Add    | Additive                      | None required; traversal may migrate           | Add flat graph queries and observers                               |
| 18  | Change | Additive compatibility path   | None; verify 93 files across 31 packs          | Bind backend access to pack identity and environment policy        |

## 61-pack compatibility summary for in-process V2

This first summary answers whether the August 25 API-review changes alone break
the converted source in today's main-realm runtime. The secure-runtime section
immediately below adds the worker-boundary changes and their separate cost.

- **No pack JavaScript changes are required** for §§1–6, 8–10 and 12–17
  under the compatibility paths proposed here.
- **§16 requires no source change** if the current connection, drop and
  unplaced-link callbacks remain the author API. Add a narrower semantic helper
  only if the live secure gate proves a repeated callback cannot meet latency.
- **§7 is the largest adapter cohort.** Queue API usage appears in up to 50
  converted files across 21 packs. Keep the existing calls while the new
  attempt model is validated.
- **§11 retains proven reads for the unchanged-source gate.** Geometry and
  interaction calls appear in 38 files across 16 packs; intent APIs may be
  added without first removing them.
- **§18 is additive in this proposal.** Channel-bound routing preserves the 93
  direct `backend.fetch()` files across 31 packs. The broader grep-derived
  cohort remains an audit input, not a migration list.
- All counts describe converted source and exclude generated declarations,
  vendored bundles, distribution output and minified files. Counts marked “up
  to” can include explanatory comments and are intentionally conservative.

## Secure sandbox constraint

The secure-node work adds a stronger test for this API: can the same extension
source run when its JavaScript has no access to the page, host globals, cookies,
credentials or live LiteGraph objects? The evidence comes from the internal
[secure-node POC](https://github.com/Comfy-Org/ComfyUI_secure_nodes/blob/main/docs/poc-results.md),
[frontend design](https://github.com/Comfy-Org/ComfyUI_secure_nodes/blob/main/docs/frontend_sandbox_design.md)
and
[interface-debt ledger](https://github.com/Comfy-Org/ComfyUI_secure_nodes/blob/main/DEBT.md).

### Bottom line

A clean secure API is possible without creating a second “secure node” API or
making every existing method return a promise. The primary acceptance target is
stronger: **the exact converted JavaScript from all 61 supported packs should
load and preserve its tested behavior and wire output in the secure runtime
without source edits.** This is a target, not a claim about the current POC.

Reaching it requires committing to four design rules before V2 is frozen:

1. Serve synchronous reads from a sandbox-local, permission-scoped document
   replica.
2. Send mutations through the same validated ECS command path used by undo and
   collaboration.
3. Move the asynchronous boundary around a host operation so existing callbacks
   can run synchronously inside the worker while the host awaits one bounded
   transaction.
4. Adapt the existing Vue, DOM, canvas and media presentation forms inside the
   sandbox instead of introducing a second UI language.

The graph, node, slot and ordinary widget API can then retain the same source
shape in local and secure environments. `render(container)` cannot receive the
host's real element, but it can receive a safe local object implementing the
measured DOM subset and emitting validated render operations. Trying to emulate
the entire browser or turning all 1,699 measured synchronous calls into RPC
promises would be the bend-over-backwards design and should be rejected.

### Author API first, transport second

The original V2 API got the most important design choice right: authors work
with definitions, handles, events and ordinary UI code. They do not program a
transport. Secure execution should preserve that model rather than exposing the
machinery needed to implement it.

The public API should pass five tests:

1. An example can be explained without mentioning workers, RPC, replicas or
   transactions.
2. A local read stays a normal synchronous read; only inherently asynchronous
   work such as fetching, storage and queue execution returns a promise.
3. Authors express exceptional behavior with an ordinary callback. We do not
   replace a five-line callback with a policy language merely because the host
   may run it elsewhere.
4. UI code uses familiar Vue components, owned DOM, canvas or media—not a
   proprietary tree-building grammar.
5. Identity and routine permissions come from the loaded pack. Authors repeat
   neither a security token nor a capability inventory at each call site.

That leaves a deliberately small authoring vocabulary:

| Author concept       | What an author writes                                      |
| -------------------- | ---------------------------------------------------------- |
| Register behavior    | `comfy.defs.extend(...)`, commands and UI contributions    |
| Read or change state | Synchronous graph, node, slot and widget handles           |
| React                | `onCreated`, `onBeforeConnect`, `widget.on(...)` and peers |
| Present UI           | A Vue component, `render(container)`, canvas or media      |
| Perform outside work | Async backend, storage, workflow and queue services        |

The worker protocol may contain callback tokens, version stamps, command
batches, remote-tree operations and permission checks. None of those need to
become public author concepts. A proposed addition should enter the public API
only when it makes ordinary pack code simpler independently of the sandbox.

This changes the preferred response to several review issues:

- keep `onBeforeConnect()`, `onUnplacedLink()`, `onSerialize()` and
  `textInteraction` as the primary behavior APIs;
- treat declarative connection, drop and keyboard policies as possible
  optimizations only after live measurements prove they are needed;
- reuse the existing Vue-component form for node widgets instead of adding an
  `ui.stack(...)` schema; and
- add owner-bound namespaces, continuously committed pack data and filtered
  widget setup because those make the API nicer in both runtimes, not because
  the worker transport demands them.

### What the POC proves, and what it does not

The POC proves the difficult browser substrate:

- one opaque-origin sandbox iframe with one worker per pack works in Chromium,
  Firefox and WebKit;
- Vue can run in the worker against a custom renderer;
- canvas and WebGL can render through a transferred `OffscreenCanvas` without
  per-frame messages;
- video, pointer and keyboard behavior can be mediated through handles and
  declared input intent; and
- a pack can drive a real sandboxed backend node end to end.

It does not yet prove that a converted pack runs unchanged. The prototype's
generic proxy turns every `comfy.*` call into a promise, flattens returned
handles into plain objects, rejects several callbacks, and gives the demo pack
a separate `comfy.ui.panel()` API. Those are POC shortcuts, not acceptable
compatibility semantics. The 1,699 synchronous call sites across 60 of the 61
packs measure work owed by the secure host, not edits owed by pack authors.

The callback inventory also needs one correction. The POC names five
synchronous-return hooks, but `widget.on('beforeSerialize')` is another
serialization decision surface, used in 32 converted files across 18 packs.
Conversely, `onDrop()` itself is already awaited by both renderers. These hooks
should first be treated as transaction-boundary work: serialize after a worker
preflight, commit a connection after a worker decision, and pass drops as
brokered values. Declarative policies remain a useful additive fast path, not a
prerequisite for running the converted source.

### Release gate: the unchanged 61

“Unmodified” means the exact converted V2 JavaScript module trees currently in
the NodeDB, including their relative imports. It does not mean re-enabling the
deprecated globals and prototype patches removed by conversion. Generated
entry metadata and inferred permission manifests may be supplied by the build
system without editing pack source. The gate preserves the supported behavior
of those conversions; it does not reverse their explicit refusals or declared
limitations.

For every supported pack, the secure gate should prove:

1. the same module bytes load with the same registration order;
2. public V2 calls and returned handle chains preserve their source shape;
3. existing behavioral harness claims pass in both runtimes;
4. saved workflow and queued prompt output remain equivalent;
5. mounted UI renders and its measured interactions work where the pack uses
   them; and
6. negative probes still cannot reach the host DOM, credentials, unrestricted
   network, another pack's state or ungranted graph scopes.

A failure enters the secure-host backlog first. It becomes a pack migration
only when a behavior-level test proves that mediation would violate the
security boundary, determinism or wire compatibility.

### One API, with transport-aware semantics

| API kind                            | Author-facing behavior                                      | Secure implementation                                                               |
| ----------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Definition and UI registration      | Synchronous declaration during module load                  | Record data and callback tokens; host applies before node registration              |
| Graph, node, slot and widget reads  | Synchronous frozen values and handles                       | Read from a scoped replica                                                          |
| Ordinary mutations                  | Existing command-shaped methods; immediate local visibility | Validate locally, enqueue the ECS command, reconcile rejection                      |
| Backend, storage and queue work     | Asynchronous                                                | Brokered RPC, as these APIs already imply                                           |
| Return-valued callbacks             | Existing callback signature                                 | Host awaits a bounded outer transaction; callback remains synchronous inside worker |
| Browser-default decisions           | Existing event-shaped callback                              | Host captures, awaits, then commits or replays the default action                   |
| Lifecycle and execution observation | Callback notification                                       | Callback token; no live host object crosses                                         |
| DOM-oriented V2 UI                  | Existing `render(container)` source                         | Sandbox-local DOM facade emits allowlisted host render operations                   |
| Canvas and media                    | Existing canvas/media source where possible                 | Transferred `OffscreenCanvas` or brokered media handles                             |

Ordinary pack code should not gain a secure branch:

```javascript
const sampler = comfy.graph.node(samplerId)
const seed = sampler?.widgets.get('seed')

if (seed && seed.getValue() === -1) {
  seed.setValue(nextSeed())
}
```

`getValue()` remains synchronous against the replica. `setValue()` remains one
committing operation and emits a command. There is no `secureSetValue()`, no
`await` added to every read and no alternate handle hierarchy.

The replica must be scoped by permission. A callback may read the node handle
the host supplied without asking for document-wide authority. Enumerating or
editing unrelated nodes is a separate grant. This avoids solving transport by
copying the user's entire workflow, including values a simple widget extension
never needed.

### Pack identity and permissions without manifest fatigue

The loader already knows the installed pack and sealed artifact. It must bind
that identity to the `comfy` facade; an author-supplied string is a namespace
hint, not a security credential. Existing explicit IDs remain valid, but new
code should not repeat its pack name in every setting, command, storage key and
backend route.

In the secure runtime, the host-created worker channel is the pack identity.
Every registration and brokered request arriving on that channel is attributed
without asking the author to pass a name. This means secure support does not
require moving all top-level code into a new `activate(pack)` wrapper. The
trusted in-process loader may add a bound facade when it can do so reliably;
until then, explicit fully qualified IDs remain the compatibility form and are
never treated as authority.

Do not make authors enumerate all 52 feature capabilities in a permission
manifest. Feature capabilities and security permissions answer different
questions:

- `supports()` answers whether a capability is usable in this host with the
  current grant;
- the manifest requests only coarse, security-relevant authority; and
- routine operations on callback-supplied nodes, pack-owned settings, storage,
  routes and UI are available by default.

A normal pack should need only an explicit entry module:

```toml
[tool.comfy.web]
extensions = ["web/main.js"]
```

A graph-wide tool or network client declares the exceptional authority:

```toml
[tool.comfy.web]
extensions = ["web/main.js"]

[tool.comfy.web.permissions]
graph = "document-write"
network = ["api.example.com"]
```

The review/build system can generate the entry list and infer candidate
permissions, then ask the author only about sensitive authority. Routine API
growth must not force manifest churn.

### Preserve callbacks at a wider transaction boundary

The main thread must never block waiting for a worker, but that does not mean
the pack callback must change. Move the asynchronous boundary outward:

- before workflow or prompt serialization, ask each affected worker for its
  synchronous callback results, then run the host's serializer;
- on connection or unplaced-link gestures, create a bounded pending
  transaction, run the existing callback against the replica, validate its
  buffered commands and commit or reject atomically;
- for browser defaults such as text input and drag acceptance, capture only
  surfaces with a registered handler, then commit or replay the default action
  after the result; and
- keep ordinary notification callbacks asynchronous because their return value
  is unused.

This preserves the existing callback source without `Atomics.wait`, main-thread
blocking or arbitrary code in the host realm. Each transaction needs a
deadline, cancellation, stale-version check and deterministic fallback. The
behavioral harness must prove that pending UI, replay and timeout semantics are
equivalent enough for every measured callback.

| Operation                   | What the host holds                  | Timeout behavior                                              |
| --------------------------- | ------------------------------------ | ------------------------------------------------------------- |
| Workflow/prompt serialize   | Final snapshot construction          | Abort with an attributed error; never silently omit pack data |
| Connection/unplaced link    | One provisional gesture transaction  | Reject the pending edit                                       |
| Drag acceptance             | Drop eligibility and visual feedback | Use the last valid cached answer, otherwise reject            |
| Text/keyboard/wheel default | The browser's default action         | Replay the default action so typing cannot be held hostage    |

The POC measured worker-side drag messaging below a frame budget, but the live
61-pack gate must measure callback execution and replay latency rather than
assuming the transport result generalizes.

`graph.serialize()` also has synchronous internal callers for cloning, undo and
other snapshots. The host therefore needs a validated, per-pack serialization
result cache. External workflow, prompt and embedded writes refresh it through
preflight; worker tasks that can change pack-local state invalidate or refresh
it; synchronous internal snapshots consume the last valid result. The audit
must cover every serializer entry point and prove clone/undo behavior rather
than assuming the user-facing save path is the only one.

Narrow declarations are still desirable as an additive, lower-latency path for
new code. There should not be a general serializable expression language.

Pack-owned saved state should be updated when the state changes, then serialized
by the host without calling the pack during save. An illustrative shape is:

```javascript
comfy.defs.extend('MyPack/Gallery', (definition) => {
  definition.declareData('gallery', { defaultValue: [] })

  definition.onCreated((node) => {
    const gallery = node.data.get('gallery')
    renderGallery(gallery)
  })
})

function commitGallery(node, gallery) {
  node.data.set('gallery', gallery)
}
```

`declareData()` and `node.data` are illustrative. The required behavior is a
host-owned, pack-namespaced, replica-readable value that participates in normal
workflow commands. It is the preferred new API, while the secure host's
pre-serialization transaction preserves existing `onSerialize()` source.

Destination-specific prompt values belong to the queue attempt rather than a
synchronous workflow-save callback:

```javascript
comfy.queue.prepare(
  { nodeTypes: ['MyPack/PromptNode'] },
  ({ nodes, values }) => {
    for (const node of nodes) {
      const prompt = String(node.widgets.get('prompt')?.getValue() ?? '')
      values.set(node.id, 'prompt', expandReferences(prompt), {
        destinations: ['prompt', 'embedded']
      })
    }
  }
)
```

The `values` draft is illustrative and deliberately narrow: it may replace a
pack-owned widget value for this attempt, not inspect or rewrite the completed
prompt. The normal saved workflow retains the live value. Existing
`beforeSerialize` handlers remain supported through the same bounded preflight.

Connection, drop and unplaced-link decisions follow the same pattern:

```javascript
comfy.defs.extend('MyPack/ImageTarget', (definition) => {
  definition.onBeforeConnect((_node, event) => {
    if (event.side !== 'input' || event.peerType === undefined) return
    return comfy.defs.isTypeCompatible(event.peerType, 'IMAGE')
  })

  definition.onDragOver((_node, event) => {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files')
  })

  definition.onDrop(async (node, drop) => {
    const image = drop.dataTransfer?.files?.[0]
    if (!image?.type.startsWith('image/')) return false
    await importDroppedImage(node, image)
    return true
  })
})
```

This remains ordinary behavior code. The host holds the proposed gesture while
the callback runs in the worker and commits its buffered commands atomically.
An accepted drop is an ordinary asynchronous notification carrying brokered
file handles. If live latency measurements later justify a static fast path,
add the smallest common constraint to the existing definition or slot model;
do not make every author learn a second policy API first.

### Secure UI with an unchanged-source compatibility target

The host's real `HTMLElement` cannot cross into a worker. To run the converted
source unchanged, the secure implementation of
`widgets.mount({ render(container) })` should supply a sandbox-local container
facade. Tree, attribute, style, text and event operations on that facade become
allowlisted Remote-DOM operations rendered by the host into a closed shadow
root. The pack receives neither a reference to the page nor a general route to
arbitrary host elements.

This is a compatibility implementation of the current V2 API, not a shim for
the deprecated LiteGraph surface. Its initial contract should be the DOM subset
actually exercised by the 61 packs, including ordinary element creation,
owned-root queries, class/style changes, listeners, form values and teardown.
Layout reads can use the latest host measurement plus observer updates where
the measured behavior tolerates it. Unsupported operations must fail with an
attributed diagnostic rather than silently diverge.

Container emulation alone is insufficient: 127 of the 133 mounted-widget files
contain a `document` or `window` usage indicator. The worker bootstrap therefore
needs scoped compatibility objects whose tree queries and global listeners are
limited to that pack's owned roots. They must not expose host `location`,
cookies, storage, credentials or unmediated network access. The corpus audit
must distinguish ordinary DOM construction from the smaller set that actually
depends on synchronous layout, a third-party runtime or page-global behavior.

The secure-native implementation should still have three explicit lanes:

1. host-rendered components and form controls for ordinary node UI;
2. host-rendered image, audio and video widgets for media; and
3. a transferred canvas for custom pixels, including 2D and WebGL.

For authors with a build step, extend the component arm already supported by
dialogs and sidebar tabs to mounted node widgets:

```javascript
import StrengthSlider from './StrengthSlider.vue'

node.widgets.mount({
  name: 'strength',
  defaultValue: 1,
  component: StrengthSlider,
  props: { label: 'Strength', min: 0, max: 2, step: 0.05 }
})
```

The pack's normal Vue runtime executes the component in its own realm. The
local host mounts it with the ordinary renderer; the secure guest mounts the
same component with the proven worker-side renderer. Packs without a build step
keep `render(container)`, which is why the two forms are alternatives rather
than separate API families. For a value-holding mount, the adapter supplies
Vue's familiar `modelValue` prop and commits `update:modelValue` through the
same widget value cell; `defineWidgetType()` can use the same component
contract. Off-canvas dialogs and panels may use a fenced webview when arbitrary
HTML is genuinely required. A third-party library works unchanged only when
the measured owned-DOM subset covers what it actually does; the secure host does
not promise the entire browser merely because the facade has familiar method
names.

`widgets.canvas()` can remain close to its existing API. The host transfers the
canvas once, then sends resize, theme and pointer data. The worker can construct
a compatible `CanvasPointerEvent` facade from plain data (`x`, `y`, `button`,
modifier keys), so current handlers need not change. Registering the handler
tells the host which surface may claim the gesture.

### Measured effect on the 61 packs

These are grep-derived converted-source cohorts, excluding generated
declarations, tests, vendored/minified bundles and distribution output:

| Surface                                     | Files | Packs | Secure-host compatibility work                                               |
| ------------------------------------------- | ----: | ----: | ---------------------------------------------------------------------------- |
| Synchronous `comfy.*` calls from the POC    | 1,699 |    60 | Replica avoids a second whole-corpus async rewrite                           |
| Graph reads                                 |   108 |    29 | Serve from permission-scoped replica data                                    |
| Graph writes                                |    51 |    18 | Emit validated ECS commands and reconcile rejection                          |
| `widgets.mount()`                           |   133 |    27 | Run unchanged against the measured Remote-DOM facade                         |
| `widgets.canvas()`                          |    31 |    14 | Preserve through `OffscreenCanvas` and event facades                         |
| `defineWidgetType()` with DOM renderer      |    15 |     7 | Use the same Remote-DOM/canvas/media adapters                                |
| Direct mounted sidebar/dialog contribution  |    26 |    16 | Use Remote DOM first; fenced webview for irreducible off-canvas applications |
| Sync decision or serialization surfaces     |    50 |    24 | Add bounded preflight and gesture transactions                               |
| `widget.beforeSerialize` within that cohort |    32 |    18 | Largest pre-serialization compatibility cohort                               |
| `backend.fetch()`                           |    93 |    31 | Preserve by binding routes to verified channel identity                      |

The union of mounted-DOM renderers, DOM widget-type renderers, directly mounted
sidebar/dialog contributions, serialization callbacks and synchronous
routing/drop decisions is 183 files across 36 packs. This is the conservative
high-risk compatibility test cohort—not a source-migration estimate. The
release target is still 61 unchanged packs. No source migration should be
budgeted until an equivalence test demonstrates behavior the secure host cannot
safely reproduce.

The UI cost is concentrated: Fill Nodes, CRT, Mixlab and Deno account for 58
of the 133 mounted-DOM files. The corpus also shows why one UI replacement does
not fit all behavior: mount sites include simple controls, media, editors,
games and full custom applications. Each should move to the matching lane, not
to a generic markup string merely because the old mechanism was DOM. The
compatibility facade may route canvas and media to their specialized channels
without changing the pack's source.

The 50 synchronous-decision files across 24 packs comprise 32
`beforeSerialize` files, 10 node `onSerialize` files, 5 `onBeforeConnect`
files, 1 `onUnplacedLink` file, 2 `onDragOver` files and 4 `onDrop` files, with
overlap. `onDrop` needs a brokered event but not a synchronous replacement;
the other cases first exercise the preflight/gesture transaction. The state,
queue-draft and small semantic helpers above remain optional lower-latency
alternatives if measurements show a specific callback path needs one.

### Changes to the numbered decisions

| Original section  | Secure-runtime consequence                                                                                      | Converted-source target                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| §1                | Separate feature capabilities from coarse security permissions; do not require a 52-item manifest.              | Unchanged                                                 |
| §2                | Preflight serialization in the worker; offer committed state and queue drafts as additive alternatives.         | Unchanged; verify 32 files across 18 packs                |
| §3 and §6         | Handles read a scoped replica; all writes, including `setValue()`, emit validated ECS commands.                 | Unchanged; retest mutation behavior                       |
| §4                | Pure graph-local resolution is already sandbox-friendly and should run against the replica.                     | Unchanged; rerun prompt gates                             |
| §5, §10, §13, §18 | Pack identity must be host-bound and reused for registrations, IDs, storage and backend routes.                 | Unchanged while explicit IDs/routes remain compatible     |
| §7                | Preparation is async and brokered; interrupt, auto-queue and batch policy require privileged authority.         | Unchanged through adapters; verify up to 21 packs         |
| §8                | The host owns install order and conflict resolution; worker completion timing cannot define either.             | Unchanged; behavioral retest                              |
| §9                | Run existing save callbacks in preflight; prefer continuously committed host-owned state for new code.          | Unchanged; verify 10 files across 8 packs                 |
| §11 and §17       | Replicate only granted scopes; prefer intent events so renderer geometry does not become replica protocol.      | Unchanged for retained reads/events                       |
| §12               | Render existing DOM-oriented calls through safe adapters; add native component/media/canvas lanes.              | Unchanged target; included in 183-file/36-pack test union |
| §14               | Declarative widget matching is directly sandboxable; lifecycle-time scans remain compatible.                    | Unchanged                                                 |
| §15               | Capture/replay browser defaults around existing callbacks; consider shortcut sugar only if latency demands it.  | Unchanged; verify 5 files across 3 packs                  |
| §16               | Hold gesture commit around existing callbacks; avoid a parallel policy language until measurements require one. | Unchanged; verify up to 10 files across 4 packs           |

### Approaches to reject

- Do not add `comfy.secure.*` or require a separate secure source tree.
- Do not turn all graph, node and widget reads into promises.
- Do not turn short behavior callbacks into a policy DSL solely to make worker
  dispatch easier.
- Do not accept a caller-provided pack string as security identity.
- Do not require every ordinary API method in a permission manifest.
- Do not promise the full browser DOM, LiteGraph or host globals. Implement the
  corpus-measured owned-DOM subset and validate every operation.
- Do not block the main thread or run pack callbacks in the host realm. Move the
  transaction boundary outward and await the worker.
- Do not prompt users at runtime for routine node-local behavior; reserve
  explicit grants and review for graph-wide writes, global queue control,
  network, device and other sensitive authority.
- Do not invent a virtual-DOM vocabulary for pack authors. Run their Vue
  component or owned DOM code through the appropriate local adapter.

### Recommendation

Ship one V2 module and one set of authoring concepts in both runtimes. Make the
unchanged 61-pack corpus a release gate. A pack should not know whether its
handles are backed by in-process ECS state or a worker-local replica. The host
chooses the execution profile and binds identity, permissions and transport.

The `render(container)` compatibility object is never the host's live element;
it is a sandbox-local owned-tree facade. New code should prefer the smaller
component, media and canvas surfaces, but adopting them is not a prerequisite
for the initial 61-pack secure run. This is a clearer rule than a second API,
pervasive `await`, an unbounded fake browser or a permission prompt for every
method.

The author-facing simplicity moves real complexity into the host: maintaining a
scoped replica, validating and reconciling commands, and rendering a remote
component tree. That is one implementation cost rather than a recurring tax on
every pack. The only unavoidable author restriction is also the honest one:
arbitrary code with a live reference to the host page cannot simultaneously be
treated as securely isolated. The compatibility layer works precisely because
the familiar object is local to the worker and every effect is mediated.

## 1. Compatibility and versioning

**Original review:** §1, “What compatibility promise are we making?”

**Compatibility and 61-pack impact:** Source-compatible policy change. No
converted pack reads `comfy.version`, `comfy.major` or `forMajor()`, so no pack
JavaScript changes are required.

**Secure-runtime impact:** No source change. `supports()` must report the
features the current host and grant actually make usable; it must not be
confused with the small set of sensitive permissions a pack requests.

### Decision carried forward

The module at `/comfy/api/v2.js` must report major version 2. Legacy extension
globals remain temporarily and follow ComfyUI's normal phased deprecation
process. The host is not promising to serve every API major forever.

### Proposed changes

1. Change `comfy.version` and `comfy.major` to the V2 contract.
2. Keep capability checks as the normal compatibility mechanism.
3. Replace the current permanent-major wording with a documented support and
   deprecation policy.
4. Add development-only diagnostics for legacy global and monkey-patch use.
5. Decide separately whether generated declarations ship in an `@comfyorg`
   package. That packaging choice does not block the runtime API.
6. Keep feature capabilities out of the permission manifest. `supports()` and
   `capabilities()` describe usable API features; the manifest requests only
   coarse security authority such as graph-wide writes or external network
   access.

### Retained usage

```javascript
import { comfy } from '/comfy/api/v2.js'

if (comfy.supports('widgets.reorder')) {
  installReorderBehavior()
}
```

Authors ask for the capability they need. They do not compare frontend release
numbers or assume that a particular minor version contains a feature.

## 2. Saved workflows and queued prompts

**Original review:** §2, “What exactly must remain unchanged in saved workflows
and queued prompts?”

**Compatibility and 61-pack impact:** No public surface change and no pack
source update. Rerun the workflow and prompt equivalence gates across all 61
packs because wire compatibility is the behavior being preserved.

**Secure-runtime impact:** Unchanged-source target. The synchronous
`widget.on('beforeSerialize')` callback is used in 32 files across 18 packs.
Before serializing, the host asks the affected worker to run those callbacks
against its replica, collects the destination overrides, then performs the
ordinary host serialization.

### Decision carried forward

Keep positional `widgets_values`, do not persist slot IDs, and retain
byte-identical workflow and prompt output as the conversion gate. Named inputs,
named outputs and future additive workflow fields are separate schema work.
The wire schema does not need to change for secure execution, but the way a
pack supplies a destination-specific value does not have to change either if
the host adds this bounded preflight.

### Existing usage retained in both runtimes

```javascript
widget.on('beforeSerialize', (event) => {
  if (event.context === 'prompt') {
    event.setSerializedValue(expandReferences(String(event.value)))
  }
})
```

This changes one pack-owned value for one serialization destination. It does
not expose the completed prompt or workflow for arbitrary rewriting. It remains
a supported behavior API in both runtimes; the secure host implements it with
the bounded preflight rather than running pack code during the final host
serializer.

### Additive lower-latency alternative

```javascript
comfy.queue.prepare(
  { nodeTypes: ['MyPack/PromptNode'] },
  ({ nodes, values }) => {
    for (const node of nodes) {
      const prompt = String(node.widgets.get('prompt')?.getValue() ?? '')
      values.set(node.id, 'prompt', expandReferences(prompt), {
        destinations: ['prompt', 'embedded']
      })
    }
  }
)
```

The queue attempt owns this narrow value draft. The pack may override its own
widget value for named destinations, but cannot inspect or rewrite the
completed prompt. Ordinary workflow saves use the committed widget value.

### Required implementation work

- Keep workflow and prompt equivalence tests as release gates.
- Document `workflow`, `prompt` and `embedded` serialization destinations.
- Add the narrow queue-attempt value draft, with ownership checks and explicit
  destination selection.
- Add a secure pre-serialization transaction and run the 32 existing files
  unchanged through the workflow and prompt equivalence gates.
- Keep the preflight bounded, cancelable and destination-scoped; a failing or
  timed-out pack cannot inspect or rewrite the completed document.
- Treat any future wire-format evolution as an explicit, versioned migration.

## 3. Handles and ECS mutations

**Original review:** §3, “Are graph handles and mutations aligned with ECS?”

**Compatibility and 61-pack impact:** Source-compatible if the public methods
are retained and their implementations are routed through commands. No pack
source changes are currently proposed; graph-mutating conversions require
behavioral retesting. Any method the audit proposes to remove must receive a
separate usage measurement and migration plan first.

**Secure-runtime impact:** No source change if handles read a scoped local
replica and the same methods enqueue validated commands. Requiring `await` for
ordinary reads or replacing every mutator with an RPC-shaped API is rejected.

### Decision carried forward

Keep ID-backed handles and frozen snapshots. Approval is conditional on every
public mutation reaching the correct ECS command, undo, collaboration and graph
scope behavior.

### Retained usage

```javascript
comfy.graph.batch(() => {
  const loader = comfy.graph.add('CheckpointLoaderSimple')
  const sampler = comfy.graph.add('KSampler')

  loader.outputs.get('MODEL')?.connectTo(sampler.id, 'model')
})
```

The author describes one graph change and receives one undo/collaboration unit.

### Required audit

Produce a table for every public mutator:

| Public call          | Command   | Undo result | Collaboration result | Scope        |
| -------------------- | --------- | ----------- | -------------------- | ------------ |
| `graph.add()`        | To verify | To verify   | To verify            | Owning graph |
| `output.connectTo()` | To verify | To verify   | To verify            | Owning graph |
| `widget.setValue()`  | To verify | To verify   | To verify            | Widget graph |
| `graph.replace()`    | To verify | To verify   | To verify            | Owning graph |

Any method still editing a LiteGraph object directly must be routed through the
command path or explicitly removed from the stable contract. A public
functional-command style can be reconsidered after this map exists; it is not
required merely to change syntax.

The audit must also prove secure command behavior: provisional IDs, immediate
replica visibility, host rejection and reconciliation, and the permission
scope of every snapshot and mutation. The sandbox must not receive an entire
workflow merely to serve a callback-supplied node handle.

## 4. Frontend execution, resolution and supply

**Original review:** §4, “Are frontend-only nodes and virtual connections
deterministic enough?”

**Compatibility and 61-pack impact:** No public surface change and no pack
source update. Rerun prompt-equivalence tests for packs using resolution and
supply because host scoping and arbitration are the relevant behaviors.

**Secure-runtime impact:** No source change. These hooks are pure,
synchronous and graph-local, so they run unchanged against the scoped replica.
The already-asynchronous prompt builder awaits the worker result at the outer
boundary.

### Decision carried forward

Keep resolver and supplier hooks synchronous, pure and graph-local. Root graphs
and subgraphs resolve independently. A root supplier must not invisibly feed an
input inside a reusable subgraph.

### Retained usage

```javascript
comfy.defs.extend('MyPack/BroadcastModel', (definition) => {
  definition.setSupply(({ self, unconnectedInputs }) =>
    unconnectedInputs()
      .filter(({ type }) => type === 'MODEL')
      .map((input) => ({
        from: { output: self.outputs[0].index },
        to: { nodeId: input.nodeId, input: input.input },
        priority: 10
      }))
  )
})
```

The pack declares candidate data flow. The host owns arbitration, tie handling,
cycle protection and prompt construction.

### Required implementation work

- Keep resolver and supplier execution scoped to the graph being built.
- Diagnose invalid, cyclic or exactly tied contributions.
- Do not add async resolution or live-graph mutation to this surface.

## 5. Widget ownership and collisions

**Original review:** §5, “What is the collision and ownership policy for
widgets?”

**Compatibility and 61-pack impact:** Additive if explicit fully qualified
widget IDs remain valid. No source update is required. Seven packs, in 16
converted files, use `defineWidgetType()` and may optionally adopt the
owner-bound form. Enforcing different literal widget IDs would instead require
coordinated Python and JavaScript changes and is not proposed here.

**Secure-runtime impact:** Unchanged-source target. The worker channel supplies
identity, and `defineWidgetType()` uses the same Remote-DOM/canvas/media
adapters as mounted widgets. A caller-provided string cannot be treated as
security identity.

### Direction from the review

Pack-ID namespacing is preferred. Core names are reserved. Deterministic,
diagnosable last-registration-wins is acceptable only as a compatibility
fallback if owner-aware scoping cannot ship in the first release.

### Proposed policy

1. Associate every registration with a host-known pack ID.
2. Reserve core widget names and reject attempts to claim them.
3. Scope an unqualified pack widget type to its owner.
4. Reject cross-owner collisions when owner identity is available.
5. Allow an explicit same-owner replacement for hot reload or deliberate
   re-registration.
6. Emit development diagnostics for every shadow, replacement or fallback LWW
   decision.
7. Specify whether unregistering a transitional LWW winner reveals the prior
   registration. Restoring the prior registration is preferable, but remains a
   decision.

### Illustrative owner-bound API

```javascript
import RatingWidget from './RatingWidget.vue'

const pack = comfy.pack

pack.defs.defineWidgetType('Rating', {
  defaultValue: 0,
  component: RatingWidget,
  props: { min: 0, max: 5 }
})
```

`comfy.pack` is illustrative. The loader supplies a facade bound to the
installed, verified pack; the author does not choose its security identity.
The component arm is also illustrative but deliberately uses ordinary Vue:
the adapter supplies `modelValue` and commits `update:modelValue`, just as for a
value-holding mounted widget. The existing `render(container, value, ...)` arm
remains valid for hand-written modules.
Explicit existing IDs such as `MyPack.Rating` remain a compatibility path. The
exact module-binding mechanism is an implementation detail and should not
require a public `forPack('user-controlled-string')` authority model.

Three binding choices remain, in preference order:

1. attribute secure registrations and requests to their host-created worker
   channel, requiring no source ceremony;
2. expose a loader-bound facade when the module loader can provide one without
   global mutable “current pack” state; or
3. keep explicit fully qualified IDs as the trusted-runtime compatibility
   form, while treating them only as names.

A mandatory `activate(pack)` wrapper would make ownership explicit, but would
force broad structural edits across the supported packs for little security
benefit in the runtime that already has a channel identity. It should remain an
optional future module shape, not a V2 prerequisite.

The component arm is illustrative of the transport-neutral UI work in §12.
Owner scoping itself is source-compatible; the 15 DOM-rendered widget-type
files across 7 packs are part of the unchanged-source compatibility test set.

For a backend-declared widget type, changing the literal type string requires
coordinated Python and JavaScript changes. Automatic owner scoping is valuable
only if the host can make that mapping without silently changing the backend
declaration or serialized widget behavior.

Namespacing does not solve a single pack registering one type twice with
different meanings. Same-owner replacement therefore remains explicit and
diagnosable rather than silently accidental.

## 6. Programmatic widget changes

**Original review:** §6, “Programmatic widget changes behave like user edits.”

**Compatibility and 61-pack impact:** No public surface change and no pack
source update. Existing `setValue()` conversions must retain their behavioral
tests because this decision preserves its committing semantics.

**Secure-runtime impact:** No source change. `setValue()` updates the local
replica immediately and emits the same validated command as a user edit; host
rejection reconciles the replica. There is still no silent setter.

### Decision carried forward

Keep one committing `setValue()` operation. Do not add a public silent setter.
Equal-value writes remain no-ops, and a programmatic write does not emit button
activation.

### Retained usage

```javascript
let applying = false

seed.on('change', (value) => {
  if (applying) return
  updateDependentState(value)
})

applying = true
try {
  seed.setValue(42)
} finally {
  applying = false
}
```

Pack-local re-entry guards and direct calls to pack-owned refresh functions are
clearer than a second write operation that bypasses host consistency.

## 7. Queue lifecycle and global run control

**Original review:** §7, “Queue lifecycle and global run control.”

**Compatibility and 61-pack impact:** Additive through retained adapters. Queue
API usage appears in up to 50 converted files across 21 packs. The measured
cohorts are 26 `run()` files across 16 packs, 10 `onBeforeRun()` files across 8
packs, 4 `guard()` files across 3 packs, 13 observer files across 10 packs, and
4 files across 4 packs using global controls. Keep their current return and
lifecycle behavior while introducing the attempt model.

**Secure-runtime impact:** Preparation and validation can be brokered and
awaited before submission, so their authoring model remains usable. Global
interrupt, auto-queue and batch controls require privileged authority. Keeping
the current calls as adapters gives all 21 packs the unchanged-source path;
permissions are attributed to the worker channel rather than new call syntax.

### Direction from the review

The current surface mixes starting a run, preparing data, vetoing execution,
observing submission and changing global queue policy. Split those powers and
repair the lifecycle before freezing the API.

### Proposed attempt model

Every run request receives an immutable attempt context:

```typescript
interface QueueAttempt {
  readonly id: string
  readonly source: 'user' | 'autoQueue' | 'core' | 'pack'
  readonly sourcePack?: string
  readonly scope: GraphHandle
  readonly signal: AbortSignal
}
```

The exact type names are illustrative. The required behavior is stable attempt
identity, attribution and cancellation.

### Proposed separation

```javascript
const stopPrepare = comfy.queue.prepare(
  { nodeTypes: ['MyPack/RemoteLoader'] },
  async ({ signal, nodes }) => {
    const latest = await loadPackData({ signal })
    nodes[0]?.widgets.get('source')?.setValue(latest)
  }
)

const stopValidate = comfy.queue.validate(
  { nodeTypes: ['MyPack/RemoteLoader'] },
  ({ nodes }) => {
    const source = nodes[0]?.widgets.get('source')?.getValue()
    return source
      ? { allow: true }
      : {
          allow: false,
          message: 'Choose a source before running.',
          nodeId: nodes[0]?.id
        }
  }
)

const receipt = await comfy.queue.run({ nodes: [target] })

if (receipt.status === 'submitted') {
  await receipt.finished
}
```

This shape makes four responsibilities explicit:

- `prepare()` performs unavoidable asynchronous preparation with an abort
  signal and deadline;
- `validate()` returns structured issues for one host-owned decision UI;
- `run()` returns a structured receipt rather than an ambiguous boolean;
- observation events report submitted, rejected, completed, failed,
  interrupted or canceled attempts without acquiring veto authority.

### Required behavior

- Evaluate policy and validation at a documented point before submission.
- Key preparation cleanup by attempt and execute it in `finally` on every exit.
- Ignore or abort late work after timeout or cancellation.
- Attribute a rejection to the responsible pack, rule and affected node.
- Define whether preparation/validation runs once per request or per batch item.
- Order handlers through the authoritative install order from §8.
- Keep prompt-time pure work in the queue-attempt value draft from §2,
  resolution or supply rather than encouraging temporary live-graph edits.

### Global authority

`interrupt()`, auto-queue mode and batch count affect the entire application.
Before stabilization, choose one of these policies:

1. expose them only as named host commands;
2. require an explicit privileged capability; or
3. retain the direct methods only in environments whose policy permits them.

The current `guard()` and `onBeforeRun()` may remain transitional adapters, but
they should not define the final lifecycle semantics.

## 8. Multiple extensions handling the same event

**Original review:** §8, “What happens when several extensions handle the same
event?”

**Compatibility and 61-pack impact:** Source-compatible behavioral change. No
pack syntax changes are required, but conversions that depend on registration
order, veto composition or replacement order must be retested against the
authoritative ordering policy.

**Secure-runtime impact:** No source change. The host must derive order from
the sealed install manifest, never from worker startup or callback completion
timing.

### Decision carried forward

Extension order follows one authoritative installation order, not filesystem
enumeration, concurrent module completion or incidental import timing. Each
event retains the merge rule appropriate to its meaning.

### Proposed policy families

| Event or registry kind          | Merge rule                                       |
| ------------------------------- | ------------------------------------------------ |
| Observers such as widget change | Run all in install order                         |
| Connection veto                 | Any explicit veto rejects                        |
| Gesture claim                   | First accepted claim in install order            |
| Resolver/supplier arbitration   | Declared priority; exact tie resolves to nothing |
| Serialization replacement       | Documented ordered replacement rule              |
| Exclusive named registry        | Owner rules from §5/§10, then diagnosed fallback |

### Retained authoring example

```javascript
comfy.defs.extend('MyPack/TypedInput', (definition) => {
  definition.onBeforeConnect((_node, event) => {
    if (event.side !== 'input' || event.peerType === undefined) return
    return comfy.defs.isTypeCompatible(event.peerType, 'MODEL')
  })
})
```

The callback reads the same in either runtime. One extension's silence cannot
override another extension's refusal; the host applies that merge rule after
collecting the bounded worker decisions. Authors do not choose arbitrary global
priorities unless the operation itself, such as supply arbitration, has a
meaningful priority model.

### Required implementation work

- Produce the complete event-by-event conflict table before release.
- Load and register contributions from one authoritative install-order list.
- Diagnose duplicate claims, keys and replacements in development builds.
- Use the same order for queue policies and widget extensions.

## 9. Workflow loading and pack-owned data

**Original review:** §9, “Opening workflows and saving pack-owned data.”

**Compatibility and 61-pack impact:** No public surface change and no required
source update. The 6 converted files across 4 packs that call
`workflow.open()` retain the same API and require behavioral retesting only.

**Secure-runtime impact:** Unchanged-source target. Ten files across 8 packs use
node `onSerialize()`; together with widget `beforeSerialize`, the serialization
cohort is 41 files across 22 packs. Run these callbacks during the bounded
pre-serialization transaction and merge only owner-scoped fields.

### Decision carried forward

Keep explicit workflow opening and namespaced pack-owned node data. Existing
save callbacks remain compatible through worker preflight. For new code, pack
state should be committed when it changes and serialized by the host. Opening a
document follows an explicit user action. Whole-document save interception,
encryption and arbitrary snapshot rewriting remain separate product decisions.

### Preferred new usage

```javascript
comfy.commands.register({
  id: 'MyPack.openWorkflow',
  label: 'Open My Pack workflow',
  async run() {
    const workflow = await choosePackWorkflow()
    if (workflow) await comfy.workflow.open(workflow)
  }
})

comfy.defs.extend('MyPack/Node', (definition) => {
  definition.declareData('state', { defaultValue: null })

  definition.onConfigured((node) => {
    restorePackState(node, node.data.get('state'))
  })
})

function savePackState(node, state) {
  node.data.set('state', state)
}
```

`declareData()` and `node.data` are illustrative. The required behavior is
host-owned, pack-namespaced document state that is visible in the replica and
participates in commands, undo, collaboration and ordinary serialization.

### Required implementation work

- Enforce or automatically supply the pack namespace for document fields.
- Keep the final host serialization synchronous and deterministic after the
  bounded worker preflight.
- Preserve the 10 `onSerialize()` files unchanged and prove owner scoping,
  timeout behavior and wire equivalence.
- Provide a compatibility read during `onConfigured()` so authors may adopt
  continuously committed state without losing old workflows.
- Document that `workflow.open()` is for an explicit user action, not a hidden
  workflow replacement during load or queue.

## 10. Global settings, commands and identifiers

**Original review:** §10, “Global settings, commands and identifiers.” See the
[recording at 05:07](https://app.fireflies.ai/view/01M0WZBFGEBSADKZJ5PXPJX4KV?t=307).

**Compatibility and 61-pack impact:** Additive if existing fully qualified IDs
remain valid. No source update is required. The owner-bound facade is an
optional simplification for the 133 converted files across 32 packs using
settings or commands. Hard namespace enforcement without that compatibility
path would require their migration and is not proposed here.

**Secure-runtime impact:** No source change if identity is loader-bound and
existing fully qualified IDs remain accepted. The string in an ID is not proof
of ownership.

### Decision carried forward

Accept settings, commands, keybindings and notifications. Reserve host IDs.
Prefer a host-supplied pack namespace, but do not break existing public IDs to
obtain it. Deterministic, diagnosed LWW is an acceptable first-release fallback.

### Illustrative owner-bound API

```javascript
const pack = comfy.pack

pack.settings.declare({
  id: 'previewQuality',
  name: 'Preview quality',
  type: 'slider',
  defaultValue: 80,
  attrs: { min: 1, max: 100, step: 1 }
})

pack.commands.register({
  id: 'resetSelected',
  label: 'Reset selected sampler seeds',
  scope: 'canvas',
  run() {
    for (const node of comfy.graph.selection()) {
      node.widgets.get('seed')?.setValue(0)
    }
  }
})
```

The stored and registered IDs remain `MyPack.previewQuality` and
`MyPack.resetSelected`; the author does not repeat the prefix. Existing code
that supplies the full IDs remains valid. `comfy.pack` is illustrative of a
facade whose identity comes from the loaded artifact, not from a string the
caller supplied.

### Proposed ownership rules

- Core IDs are reserved and cannot be replaced by packs.
- Pack-owned writes default to the caller's namespace.
- Reading or invoking a documented host setting or command remains possible.
- Writing a host setting or replacing a host command requires a separately
  documented permission or is rejected.
- Default keybindings must state their interaction scope and must not consume
  text-editor input accidentally.
- Duplicate behavior follows the install order and diagnostics from §8.

The same owner-bound facade should be reused by widget types (§5), storage
(§13) and backend access (§18) rather than inventing four identity systems.

## 11. Renderer-independent geometry and interaction

**Original review:** §11, “Renderer-independent geometry and interaction.” See
the [recording at 10:31](https://app.fireflies.ai/view/01M0WZBFGEBSADKZJ5PXPJX4KV?t=631).

**Compatibility and 61-pack impact:** Source-compatible while proven reads are
retained. Geometry and interaction calls appear in 38 converted files across
16 packs. Retain them for the unchanged-source gate and add higher-level intent
operations without forcing immediate migration.

**Secure-runtime impact:** No source change for retained reads and semantic
events. Geometry snapshots come only from granted replica scopes. Prefer
host-owned anchors and gesture events so renderer internals do not become a
large synchronization protocol.

### Decision carried forward

Prefer intent-level behavior and host-owned placement over renderer math.
Pack-owned canvas widgets may perform hit testing inside their own surface.
Audit every remaining geometry call against a real conversion and retain only
answers without a higher-level equivalent.

### Preferred usage

```javascript
import ControlsWidget from './ControlsWidget.vue'

const stopMove = comfy.onNodeMoved(({ node }) => {
  updatePackStateFor(node)
})

const stopDragEnd = comfy.onNodeDragEnd((nodes) => {
  commitDropBehavior(nodes)
})

node.widgets.mount({
  name: 'controls',
  component: ControlsWidget,
  props: { node, onReset: resetControls }
})
```

The host reports the gesture or supplies an owned presentation surface. The
pack does not reconstruct zoom, pan, title height or slot geometry. The
component arm on `widgets.mount()` is additive and illustrative; it reuses the
Vue model already accepted for dialogs and sidebar tabs. The existing
`render(container)` arm remains the no-build alternative and receives an owned
container rather than the host page in secure execution.

### Required audit

Classify `getBounds`, `getScreenRect`, `getSlotPosition`, `nodeAt`, pointer
position and viewport events by observed use:

- retain a query when a pack truly needs the answer;
- replace repeated placement math with a host-owned anchor or placement API;
- replace gesture reconstruction with semantic click, drag and lifecycle
  events;
- advertise renderer-specific capabilities through `supports()` rather than
  silently doing nothing.

## 12. Host UI contributions and theming

**Original review:** §12, “Host UI contributions and theming.” See the
[recording at 15:24](https://app.fireflies.ai/view/01M0WZBFGEBSADKZJ5PXPJX4KV?t=924).

**Compatibility and 61-pack impact:** Additive public metadata plus
source-compatible host rendering behavior. Existing typed contributions can
receive owner attribution automatically, so no pack source update is required.

**Secure-runtime impact:** Unchanged-source target. Host-rendered badges,
buttons, menus and prompts are directly bridgeable. The current mounted
sidebar/dialog arms pass a live `HTMLElement` or host-mounted Vue component;
direct calls appear in 26 files across 16 packs. In secure execution the same
source receives the owned Remote-DOM facade. A fenced webview remains available
for an off-canvas application whose behavior exceeds that measured subset.

### Decision carried forward

Keep host-rendered contributions for sidebars, top bars, actions, dialogs,
menus, badges and prompts. Separate renderer-neutral components from trusted
local DOM presentation. Do not add an unrestricted portal, host DOM selectors,
global CSS or a generic schema that can rewrite arbitrary host regions.

### Proposed changes

1. Associate every UI contribution with its pack identity.
2. Make pack ownership visible in host dialogs so users can distinguish a pack
   dialog from a core decision or warning.
3. Give menu contributions stable IDs and explicit add/modify/replace behavior
   under the ownership and ordering rules from §8 and §10.
4. Keep the host responsible for placement, lifecycle, accessibility and theme
   tokens.
5. Add the existing Vue `component` arm to `widgets.mount()` and
   `defineWidgetType()`; use the worker-side Vue renderer in secure execution.
   Keep media and canvas as specialized lanes, implement secure
   `render(container)` with the owned Remote-DOM facade, and reserve a live
   host element for the trusted/local runtime.
6. Allow a fenced webview for off-canvas applications that genuinely require
   arbitrary HTML, without granting access to the host page.

### Illustrative usage

```javascript
import ModelInfoDialog from './ModelInfoDialog.vue'

comfy.ui.showDialog({
  key: 'MyPack.modelInfo',
  title: 'Model information',
  component: ModelInfoDialog,
  props: { modelId }
})
```

The host can display “Provided by MyPack” from the bound owner identity; the
pack should not supply trusted-looking attribution text itself. The component
form already exists for dialogs and sidebars. The secure guest runs the pack's
same component through its worker-side Vue renderer rather than sending the
component object into the host. The existing `render(container)` form is
preserved through the owned facade for packs without a build step.

```javascript
comfy.defs.extend('MyPack/Loader', (definition) => {
  definition.addMenuItem({
    id: 'MyPack.refreshModels',
    label: 'Refresh models',
    run(node) {
      void refreshModels(node)
    }
  })
})
```

The exact menu replacement API remains to be specified. Direct interception of
the renderer's menu constructor remains outside the boundary.

## 13. Per-user extension storage

**Original review:** §13, “Per-user extension storage.” See the
[recording at 23:32](https://app.fireflies.ai/view/01M0WZBFGEBSADKZJ5PXPJX4KV?t=1412).

**Compatibility and 61-pack impact:** Additive while the explicit namespaced
key API remains valid. No source update is required. One converted pack, in one
file, currently uses `comfy.storage` and may optionally adopt owner-scoped
storage.

**Secure-runtime impact:** No source change. Storage is already asynchronous
and brokerable; loader-bound ownership prevents one pack from addressing
another pack's data.

### Decision carried forward

Keep host-managed extension storage for reusable presets, templates and
libraries that should follow the user. It is separate from small settings.

### Proposed owner-bound API

```javascript
const storage = comfy.pack.storage

await storage.set('presets/portrait', JSON.stringify(preset))

const stored = await storage.get('presets/portrait')
const presetNames = await storage.list('presets')
const usage = await storage.usage()

if (stored) applyPreset(JSON.parse(stored))
console.info(usage.usedBytes, usage.quotaBytes)
```

`usage()` is proposed. Automatic ownership removes the need to repeat a prefix
and prevents one pack from addressing another pack's data.

### Required policy and implementation work

- define per-pack and per-user quotas;
- define retention, backup and synchronization expectations;
- decide what uninstall and reinstall do;
- provide a user-visible inventory and cleanup path;
- define behavior when a quota is exceeded;
- preserve the current explicit namespaced-key API as a compatibility path.

## 14. Definition selection and lifecycle timing

**Original review:** §14, “Definition selection and lifecycle timing.” See the
[recording at 25:06](https://app.fireflies.ai/view/01M0WZBFGEBSADKZJ5PXPJX4KV?t=1506).

**Compatibility and 61-pack impact:** Additive. Existing `onCreated()` and
per-instance `WidgetHandle.on()` code remains valid, so no pack update is
required. Converted lifecycle scans may move to the declarative registration
after semantic review; that is an optional simplification, not a forced
migration.

**Secure-runtime impact:** No source change. Existing `onCreated()` scans run
against replica-backed handles when their callback token is invoked. In the
proposed extension form, the selector is registration data, matching occurs in
the host, and callback tokens receive only the permitted node and widget
handles.

### Decision carried forward

Keep filtered node-definition hooks for behavior that applies to matching node
types. Add a declarative widget extension mechanism so an extension does not
wait for every node's `onCreated`, iterate or search its widgets, and attach the
same callback instance by instance.

### Pattern being replaced

```javascript
comfy.defs.extend('MyPack/PromptNode', (definition) => {
  definition.onCreated((node) => {
    for (const widget of node.widgets) {
      if (widget.name === 'prompt') {
        widget.on('change', updatePromptState)
      }
    }
  })
})
```

The user behavior is valid. The lifecycle-time iteration is unnecessary work,
misses widgets materialized later, and makes each extension own subscription
cleanup.

### Proposed additive API

```javascript
const stop = comfy.widgets.extend({
  when: {
    node: 'MyPack/PromptNode',
    name: 'prompt',
    kind: 'textarea'
  },
  setup({ node, widget }) {
    return widget.on('change', (value, previousValue) => {
      updatePromptState(node, widget, value, previousValue)
    })
  }
})
```

`setup()` deliberately hands the author the same widget handle and event API
used everywhere else. It is a host-owned matching and lifecycle mechanism, not
a second callback vocabulary. The returned teardown follows the familiar
subscription pattern.

Names are illustrative. The required behavior is:

1. the extension registers one behavior and one selector;
2. the host matches widget entities as they materialize;
3. matching works for loaded, newly created, dynamically added and promoted
   widgets according to documented ownership rules;
4. the host tears down callbacks when the widget or extension disappears;
5. multiple matching extensions compose according to §8.

### Proposed selector vocabulary

```typescript
interface WidgetSelector {
  readonly node?: DefSelector
  readonly name?: string | RegExp
  readonly kind?: WidgetKind | readonly WidgetKind[]
  readonly widgetType?: string | readonly string[]
  readonly capabilities?: readonly WidgetCapability[]
}
```

`kind` is the semantic host control, such as `textarea`, `combo` or `button`.
`widgetType` remains available for exact pack-specific types. The conversion
corpus still contains legitimate exact-type checks, so this proposal does not
remove it.

### Existing escape hatches retained

- `defs.extend(...).onCreated(...)` remains for real per-node initialization.
- `WidgetHandle.on(...)` remains for behavior chosen dynamically for one
  specific instance.
- Asynchronous instance setup remains the pack's responsibility and must use
  cancellation plus `isDeleted` checks.

The new registration is additive. It does not require removing either existing
surface.

## 15. Interaction with host-owned text editors

**Original review:** §15, “Interaction with host-owned text editors.” See the
[recording at 29:20](https://app.fireflies.ai/view/01M0WZBFGEBSADKZJ5PXPJX4KV?t=1760).

**Compatibility and 61-pack impact:** Additive. No source update is required.
Five converted files across 3 packs, containing 6 text-interaction
subscriptions, may optionally adopt the filtered widget extension mechanism.

**Secure-runtime impact:** Unchanged-source target for the 5 files across 3
packs. The host captures browser defaults only on editors with a registered
handler, sends a compatible event facade to the worker, then commits or replays
the default action based on `preventDefault()`. The menu event is an owned
anchor facade; `setValue()` and `focus()` become brokered actions.

### Decision carried forward

Support augmentation of the host multiline text widget through the widget
extension mechanism from §14. Do not create a separate global text-editor
registry. Single-line text is not required by the conversion evidence for the
first release.

### Existing source retained by the compatibility transaction

```javascript
widget.on('textInteraction', (event) => {
  if (event.kind === 'keydown' && event.key === 'Enter' && event.ctrlKey) {
    event.preventDefault()
    runPromptText(event.value)
  }

  if (event.kind === 'input') {
    updateCompletions(event.value, event.selection, event.menuEvent)
  }
})
```

The event facade records cancellation synchronously inside the worker. The host
has already held the browser default, so it can commit the pack's result or
replay the default edit after the bounded response.

### Additive native usage

```javascript
comfy.widgets.extend({
  when: {
    node: 'MyPack/PromptNode',
    name: 'prompt',
    kind: 'textarea',
    capabilities: ['textInteraction']
  },
  setup({ widget }) {
    return widget.on('textInteraction', (event) => {
      if (event.kind === 'keydown' && event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault()
        runPromptText(event.value)
      }

      if (event.kind === 'input') {
        updateCompletions(event.value, event.selection, event.menuEvent)
      }
    })
  }
})
```

The selector names the host capability rather than the current renderer's
`customtext` implementation. It applies only to the selected node definitions
and widgets; it is not a document-wide keyboard listener. The API does not
require a separate `capture` declaration: registering `textInteraction` tells
the host exactly which editors need mediation, and `preventDefault()` keeps the
familiar decision at the behavior site. The event retains its current value,
selection, `menuEvent`, `setValue()` and `focus()` surface. In secure execution
those are local facade methods backed by messages; authors do not handle
transport-shaped data. A compact shortcut matcher can be added later if
measured worker latency makes holding every cancelable key event on those
selected editors too costly.

### Required event policy

- define listener order using §8;
- merge cancellation decisions deterministically and diagnose conflicts;
- define capture/replay behavior for input, selection, wheel, composition and
  accessibility events before claiming transparent compatibility;
- define behavior when one listener changes text during dispatch;
- keep asynchronous completion results cancelable and attributable;
- state which keyboard and wheel actions an extension may suppress;
- ensure a pack cannot observe text outside widgets selected by its rule.

### Explicit first-release scope

Included:

- the host multiline textarea for a backend `STRING` with `multiline: true`;
- caret, selection, input, keyboard and wheel interaction already represented
  by `textInteraction`;
- plain serializable menu anchors and host capture/replay on matched editors.

Not included yet:

- single-line text controls;
- pack-owned editors mounted through `widgets.mount()`;
- arbitrary CodeMirror, Ace or custom widget renderers;
- a global `textEditors()` collection;
- high-level completion or tokenizer providers.

Those can be additive later if the host deliberately bridges them into the same
capability model.

## 16. Slot metadata, link routing and node replacement

**Original review:** §16, “Slot metadata, link routing and node replacement.”
See the
[recording at 43:28](https://app.fireflies.ai/view/01M0WZBFGEBSADKZJ5PXPJX4KV?t=2608).

**Compatibility and 61-pack impact:** No required public surface change. Keep
`onUnplacedLink()` as the supported behavior API. Only one converted file, in
rgthree-comfy, calls it; the broader routing/drop cohort needs behavioral
retesting, not migration. High-level slot reads, connection operations and node
replacement remain source-compatible.

**Secure-runtime impact:** The broader routing/drop cohort is 10 files across
4 packs: 5 use `onBeforeConnect()`, 1 uses `onUnplacedLink()`, 2 use
`onDragOver()` and 4 use `onDrop()`, with overlap. The unchanged-source target
uses a pending gesture transaction for connection veto and link routing,
conservative drag acceptance plus cached worker results for `onDragOver()`, and
a brokered `DragEvent` facade for `onDrop()`.

### Decision carried forward

Publish slot reads and high-level host operations, not low-level routing and
repair internals. Keep one host-owned replacement path so all ECS state changes
together. Do not persist slot IDs in this release.

### Accepted operations

```javascript
comfy.graph.batch(() => {
  node.outputs.get('old_output')?.moveLinksTo('new_output')

  node.outputs.get('new_output')?.modify({
    name: 'model',
    label: 'MODEL',
    type: 'MODEL',
    shape: 'directional'
  })
})

const replacement = comfy.graph.replace(node.id, 'KSamplerAdvanced')
```

`moveLinksTo()` preserves link identity. `replace()` owns compatible value,
property and link transfer as one operation.

### Keep behavior callbacks; add helpers only from evidence

`onBeforeConnect()`, `onDragOver()` and `onUnplacedLink()` make compact,
understandable author code. They should remain the primary API, not be demoted
to legacy adapters merely because secure execution places a worker behind
them:

```javascript
comfy.defs.extend('MyPack/ContextPipe', (definition) => {
  definition.onBeforeConnect((_node, event) => {
    if (event.side !== 'input' || event.peerType === undefined) return
    return comfy.defs.isTypeCompatible(event.peerType, 'CONTEXT')
  })

  definition.onDragOver((_node, event) => {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files')
  })

  definition.onDrop(async (node, event) => {
    const file = event.dataTransfer?.files?.[0]
    if (!file || file.type !== 'application/json') return false
    await importContext(node, await file.text())
    return true
  })

  definition.onUnplacedLink((node, event) => {
    if (event.type !== 'CONTEXT' || event.side !== 'output') return false
    return connectContextToPeer(node, event)
  })
})
```

The host holds the gesture, runs the callback against the local replica, then
validates and commits the resulting commands. The author still states the
behavior once, at the point where it belongs.

The alternatives are:

| Alternative                          | Use it when                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------- |
| Existing callback                    | The answer depends on live node, slot, peer or pack state                   |
| Existing definition/slot metadata    | Type compatibility or another static constraint already expresses it        |
| A small semantic helper              | Several real packs repeat one operation and the helper is useful in-process |
| A general serialized policy language | Do not add; it duplicates JavaScript and grows a second API                 |

The five measured connection callbacks demonstrate why a general policy object
is not actually simpler. They cover replacing a dynamic input, peer
widget-input metadata, pack-controlled output availability, excluding a peer
node type and preventing a topology cycle. If profiling finds one common case
too slow across the worker boundary, add that case to an existing concept—for
example a slot's committed `connectable` state or a standard cycle guard—and
leave the callbacks for everything else. An accepted drop remains an async
notification with brokered file handles. A pack still must not replace the
global link-routing algorithm.

### Deferred work

- persistent serialized slot IDs;
- author-supplied global routing priorities;
- a replacement planning API with stale-plan semantics;
- richer dynamic-schema declarations not already covered by V3 definitions.

Before release, specify ambiguous name/index replacement, dropped-link
reporting, metadata merge rules and which cosmetic-looking fields serialize.

## 17. Graph scopes, reusable subgraphs and groups

**Original review:** §17, “Graph scopes, reusable subgraphs and groups.” See the
[recording at 48:51](https://app.fireflies.ai/view/01M0WZBFGEBSADKZJ5PXPJX4KV?t=2931).

**Compatibility and 61-pack impact:** Additive. Existing graph traversal and
version observation remain valid, so no source update is required. Packs may
adopt flat queries and observers to remove manual scans and polling.

**Secure-runtime impact:** No source change. Queries run against only the graph
scopes granted to the pack; observers deliver scoped replica changes. A
callback-supplied node does not imply permission to enumerate the document.

### Decision carried forward

Keep graph-scoped identity, reusable subgraph definitions, geometric group
membership and graph-local resolution. Do not create a separate expanded graph
entity for every visible subgraph instance. Prefer flat queries and observers
over making every author traverse every scope and repeatedly scan its members.

### Proposed additive query and observer shape

```javascript
const nodes = comfy.graph.queryNodes({
  scope: 'root-and-subgraphs',
  type: /^MyPack\//,
  rendered: true
})

const stop = comfy.graph.observeNodes(
  {
    scope: 'root-and-subgraphs',
    group: selectedGroup
  },
  ({ added, removed, changed }) => {
    updatePackIndex({ added, removed, changed })
  }
)
```

The names and selector details are illustrative. The important change is one
host-owned query over graph-scoped entities rather than nested manual traversal
and polling `graph.version`.

### Proposed narrow group signal

```javascript
const stop = scope.onGroupsChanged((event) => {
  if (
    event.kind === 'added' ||
    event.kind === 'removed' ||
    event.kind === 'boundsChanged' ||
    event.kind === 'membershipChanged'
  ) {
    rebuildGroupIndex(scope)
  }
})
```

Because membership is geometric, moving a node across a group's bounds must be
defined as `membershipChanged` even though no stored parent field changed.

### Boundaries retained

- subgraph definitions are shared, not copied per visible instance;
- node identity includes graph scope;
- supply and resolution do not cross a subgraph boundary invisibly;
- explicit instance scopes and persisted group membership are later work.

## 18. Backend access, extension events and session identity

**Original review:** §18, “Backend access, extension events and session
identity.” See the
[recording at 61:40](https://app.fireflies.ai/view/01M0WZBFGEBSADKZJ5PXPJX4KV?t=3700).

**Compatibility and 61-pack impact:** Additive while existing explicit routes
and event names remain supported. No source update is required. Direct
`backend.fetch()` appears in 93 converted files across 31 packs. A broader
grep-derived cohort reaches 168 files across 38 packs, but includes comments and
already scoped calls and must be classified by behavior.

**Secure-runtime impact:** This is foundational but can remain source
compatible. Direct `backend.fetch()` use appears in 93 files across 31 packs;
the host can map the same relative route to the verified pack backend. Direct
internet access is separate and requires an explicit network permission.

### Decision carried forward

Frontend packs must be able to call their own Python backend endpoints with the
host's authentication and base path. Route ownership, event ownership,
permissions, session semantics and environment availability still require
backend and security review.

### Proposed owner-bound API

```javascript
const backend = comfy.pack.backend

const response = await backend.fetch('/models')
const models = await response.json()

const stopProgress = backend.on('progress', (detail) => {
  if (isProgressMessage(detail)) updateProgress(detail)
})

const stopSession = backend.onSessionChanged((sessionId) => {
  correlateEphemeralWork(sessionId)
})
```

The host maps `/models` and `progress` into the pack's owned route and event
namespace. `onSessionChanged()` is proposed; session identity remains ephemeral
and must not be saved as user, workflow or node identity. `comfy.pack` is bound
by the loader; the author does not claim a backend namespace by spelling it.

### Required policy decisions

- establish a shared, trustworthy identity between the JavaScript and Python
  halves of a pack;
- restrict the owner-bound backend facade to the pack's own routes;
- namespace backend events and validate ownership;
- define payload size and capability restrictions;
- define desktop, local browser and hosted-cloud availability separately;
- require manifest permission for direct network, device and special resource
  access without making pack-owned routes or storage permission boilerplate;
- publish connection-change and unavailable-session behavior.

Generated typed RPC can be added later for packs that want it. Arbitrary
same-origin access should not be mistaken for a cloud security boundary.

## Recommended implementation order

1. Make the unchanged converted source trees and their relative module imports
   load in one worker per pack; remove the POC's single-blob-module limitation.
2. Introduce one channel-bound owner identity and reuse it for widgets, IDs,
   storage, UI and backend access (§5, §10, §12, §13, §18).
3. Separate feature capabilities from coarse security permissions and fix the
   V2 version/policy text (§1).
4. Complete the mutation-to-command audit and implement the permission-scoped
   replica, optimistic command and reconciliation contract (§3, §6, §17).
5. Implement bounded serialization, gesture and browser-default transactions
   for the existing callbacks (§2, §9, §15, §16).
6. Implement the corpus-measured Remote-DOM compatibility facade, canvas/media
   routing and fenced off-canvas webview (§5, §11, §12).
7. Establish authoritative install order and the conflict-policy table (§8).
8. Repair and reshape queue attempts while retaining the existing calls as
   adapters (§7).
9. Run the exact 61-pack source through secure behavioral and wire-equivalence
   gates; classify failures by user behavior rather than API name.
10. Add document state, queue drafts and Vue-component arms for mounted/type
    widgets as authoring improvements—not migration prerequisites. Add a
    connection or input helper only when live measurements prove one repeated
    case needs it (§2, §9, §12, §15, §16).
11. Implement declarative widget callback matching and flat graph observers as
    additive simplifications (§14, §17).
12. Regenerate declarations, update Node API documentation and redistribute the
    contract to every converted pack.

## Compatibility statement

For the current in-process runtime, the owner-bound facades, declarative widget
extensions, text interaction, storage policy, graph observers and session
observer can all be additive. The version correction, install-order policy, UI
attribution and command-routing audits change host policy or behavior without
requiring pack syntax changes. Retaining `onUnplacedLink()` and current queue
calls as supported compatibility paths removes the known immediate migrations
while the queue attempt model is validated.

For secure execution, the acceptance target is all 61 converted packs running
from their current source. The local replica preserves ordinary synchronous
graph/node/widget code, channel-bound brokering preserves backend access, the
Remote-DOM facade preserves the current mounted-UI call shape, and bounded
outer transactions preserve return-valued callbacks without blocking the main
thread. The 183 files across 36 packs are the high-risk compatibility test set,
not a planned migration list.

The current POC has not met that gate. Relative imports, handle chaining, the
replica, callback transactions and the DOM facade still require integration.
When a pack fails, first repair the secure implementation of the V2 behavior.
Require a pack edit only after an equivalence test proves the behavior depends
on an unsafe capability that cannot be mediated. The exception must name the
user-visible behavior and why mediation would violate security, determinism or
wire compatibility.

This does not bend the public API around the sandbox. It makes the host pay the
transport cost once while authors keep one source. New declarative and
renderer-neutral forms remain worthwhile because they are smaller, faster and
easier to secure, but the supported 61 packs should not have to adopt them just
to pass the first secure-runtime release.

Because the API is not yet stable, any deliberate breaking change should land
before the contract is frozen. It should still be justified against the
converted behavior, accompanied by the affected-pack list, and followed by
regenerated declarations for all 61 packs.
