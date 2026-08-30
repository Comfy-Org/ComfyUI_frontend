# Custom node editor — frontend technical design

Scope: the cloud-only custom node authoring surface under
`src/platform/customNodes/`, plus its graph-menu entry point. Status: proof of
concept. Backend contract and evaluation results live in the cloud repo at
`docs/design/secure-custom-node-agent-poc-results.md`.

## Purpose

Let a user create and edit their own ComfyUI custom nodes without leaving the
browser, with an agent that does the coding. The user names a pack and a node,
optionally says what it should do, watches the agent work, and ends with a
working node on their graph.

## Constraints that shaped the design

- **No code execution in the browser.** The editor is a Monaco file workbench:
  no terminal, no extension host, no plugin installation, no credentials. Every
  execution happens server-side in a disposable sandbox.
- **The server owns the truth.** The workspace lives in an ephemeral manager
  session. The client never mutates files locally; it sends operations and
  re-renders whatever the server returns.
- **The agent does the work, it does not propose it.** Its finished edits are
  applied and checkpointed; the human's safety net is rollback, not review.
  (The API still says "proposal" internally — that name predates the decision.)
- **Cloud-only.** Registered inside the `isCloud` block in
  `src/extensions/core/index.ts` so it tree-shakes out of OSS builds.

## Module map

```
src/platform/customNodes/
├── components/
│   ├── CustomNodePacksDialog.vue        pack list, upload, per-pack ⋯ menu
│   ├── CustomNodeCreateDialogContent.vue  name + first-instruction form
│   ├── CustomNodeEditorDialog.vue       full-screen editor shell, toolbar, polling
│   ├── CustomNodeWorkbench.vue          tree + agent panel layout
│   ├── CustomNodeTreeEditor.vue         monaco-tree-editor adapter
│   └── CustomNodeCodeEditor.vue         diff view for a selected change
├── composables/
│   ├── useCustomNodeEditor.ts           all manager HTTP, DTO ↔ view mapping
│   ├── useCustomNodeCreateFlow.ts       shared create flow (both entry points)
│   ├── useCustomNodeEditorDialog.ts     opens the editor dialog
│   └── useCustomNodePacks.ts            module-level pack cache
├── utils/
│   ├── packIdentity.ts                  node definition → owning user pack
│   ├── nodeNaming.ts                    display name → node class (mirrors Go)
│   └── customNodeEditorState.ts         per-pack UI state in localStorage
└── graphMenuExtension.ts                canvas / node context menu items
```

## Entry points

Both funnel into one flow — `useCustomNodeCreateFlow().startCreateFlow(pack?)` —
so behaviour cannot drift between them:

1. **Custom Nodes panel** — `Create`, or a pack's ⋯ menu → `Create node`.
2. **Graph canvas right-click** — `Create Node`, positioned above `Paste`
   (extension items may set `beforePaste`; see below). With packs present it
   opens a submenu: "In a new pack…" or a specific pack.
3. **Graph node right-click** — `Edit Node`, shown **only** for nodes belonging
   to the workspace's own packs.

### Distinguishing a user's node from a registry node

`packIdentity.ts` maps a definition's `python_module` back to an uploaded pack.
Registered packs load as `custom_nodes.pack_<slug>_<uid>…`; both that segment
and the pack's revision id are normalised through the same collapse so the
comparison survives the loader's identifier mangling. Core, extras and
registry-installed nodes yield `null`, so `Edit Node` never appears for them.

### Menu ordering

Extension canvas items are appended after the built-ins by default. An item may
set `beforePaste: true`; `useContextMenuTranslation` splices those in above the
built-in `Paste` entry before labels are translated, so ordering is
locale-independent. Unmarked items are unaffected.

## The create flow

`useCustomNodeCreateFlow` owns naming, session creation, the editor handoff and
post-submit graph placement.

1. **Refresh packs**, then open the naming dialog with defaults that avoid
   collisions: pack `New Node Pack`, `New Node Pack (2)`, …; node `New Node`,
   `New Node (2)`, … computed from the nodes the target pack already registers.
2. **Validate inline.** Invalid characters, an existing pack name, or a node
   name already in that pack each show a message under the field and disable
   `Create`. Cancel closes with nothing created.
3. **Create the session** with `node_name`, so the manager scaffolds (new pack)
   or injects (existing pack) a named pass-through node and opens the editor on
   that file.
4. **Hand off the first instruction.** Empty → the editor simply opens on the
   new file. Non-empty → the workbench sends it as the agent's first turn on
   mount.
5. **Retry on rejection.** A 409 from the manager reopens the dialog with the
   entered values rather than dropping the user back to the graph.
6. **Place the node after submit** (below).

## Placing the node after submit — the race

Submitting returns as soon as the manager stores the pack, but the runtime
needs a few more seconds to install it and publish its definition. Two defects
came from this, both now fixed and regression-tested:

- **Refreshing once loses the race.** A single refresh at submit time finds
  nothing and gives up, and nothing refreshes again — so the node is neither
  placed nor searchable until a page reload. The flow now keeps refreshing
  until the definition appears (through the endpoint that also updates the
  ingest-side catalog, not just this tab's cache), then places it, and warns
  via toast if it never arrives within 90 s.
- **A stale definition is not a definition.** The app synthesises a
  `frontend_only` placeholder for any LiteGraph type the backend does not
  serve, so a node type left registered by an earlier pack satisfies a naive
  presence check. Placing it yields a node the backend cannot execute: it
  renders with the old pack's inputs and the run completes with no output.
  The wait now requires a definition the backend actually serves and, when the
  submitted revision is known, one belonging to **that** revision.

## The agent panel

`CustomNodeWorkbench.vue` renders a standard chat surface:

- **Start state**: one capability sentence and a highlighted sample-prompt
  chip, docked above the composer; replaced by the conversation on first send.
- **Turn log**: user bubbles, plain agent replies, an expandable backend-test
  bullet (auto-expanded on failure), rendered output thumbnails, change rows
  that toggle their diff in the main pane, and a quiet `✓ Changes applied ·
⟲ Restore` row.
- **Activity**: while the agent works, a heartbeat-wave indicator sits above
  the composer with a phase label, and the agent's real steps stream in from
  the session's `agent_activity` (polled once a second) — plan sentence, doc reads,
  code and doc searches, sandbox runs, image inspections, repairs. When the
  turn ends the trail collapses into a "Worked through N steps" expander.
  **Indicator present means the agent is working; absent means it is idle.**
- Answer-only turns (zero file changes) render as plain answers with no apply
  or restore chrome.

Styling uses Comfy semantic tokens only (no raw palette values), Inter
throughout, with monospace reserved for tracebacks, logs and structured output.

## Checkpoints

Every applied turn is checkpointed server-side under its proposal id. The turn's
`Restore` posts to `/checkpoints/{id}/restore`; the manager snapshots current
edits first, so restores are themselves reversible, and returns the rewound
files which the tree reloads in place. No git vocabulary appears in the UI.

## State ownership

| State                                                          | Owner                                                              | Lifetime                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------ |
| Pack list                                                      | module-level refs in `useCustomNodePacks`                          | tab; shared by panel and menus |
| Session, files, checkpoints                                    | manager                                                            | ephemeral session (2 h)        |
| Open tabs, active file, explorer width, agent panel visibility | `customNodeEditorState` in localStorage, keyed by workspace + pack | persists; migrates on rename   |
| Conversation                                                   | `CustomNodeWorkbench` component state                              | dialog lifetime                |
| Agent turn history                                             | manager session                                                    | session                        |

## Manager API surface

All calls live in `useCustomNodeEditor.ts`, which maps snake_case DTOs to
camelCase views and raises `CustomNodeEditorRequestError` carrying the status
(the create flow keys its 409 retry off it).

| Method                                       | Endpoint                                                   |
| -------------------------------------------- | ---------------------------------------------------------- |
| `createSession`                              | `POST /customnodes/editor/sessions` (`node_name` optional) |
| `getSession`                                 | `GET …/{id}` — also carries `agent_busy`, `agent_activity` |
| `renameSession`                              | `PATCH …/{id}`                                             |
| `getFiles` / `saveFiles` / `applyOperations` | `GET`/`PUT …/{id}/files`                                   |
| `createAgentProposal` / `applyAgentProposal` | `…/agent/proposals[…/apply]`                               |
| `restoreCheckpoint`                          | `POST …/checkpoints/{id}/restore`                          |
| `runSessionAction`                           | `POST …/{id}/actions` (validate, submit)                   |
| `refreshNodeDefinitions`                     | `POST …/{id}/refresh` then `app.reloadNodeDefs()`          |
| `abandonSession`                             | `DELETE …/{id}`                                            |

## Testing strategy

- **Unit (Vitest, 70 tests)** for logic: create-flow naming, cancel, prompt
  handoff, 409 retry, the registration race and the stale-definition case (fake
  timers); pack identity mapping; menu building and `Edit Node` gating;
  workbench conversation, activity indicator, restore, answer-only turns.
- **Browser (Playwright, mocked cloud)** for anything involving real layout,
  portals or menus — where unit tests are structurally blind. These earned
  their keep: the z-order fix, the menu-dismissal fix and the collapsed-details
  semantics were all caught only here.
- **Live opt-in** (`CUSTOM_NODE_AGENT_LIVE=1`) drives the real manager, model
  and sandbox end to end.

## Known gaps

- Any submit path other than the create flow can still leave the node library
  stale until a refresh; the durable fix is server-side (see the POC results
  document).
- `customNodePacks.resize.spec.ts` fails on a toolbar-height assertion; bisected
  to pre-existing, unrelated to this work.
- If the agent edits a file you are typing in, the apply-time reload wins for
  that buffer. A merge strategy is future work.
- The dialog cannot check node-name collisions inside a pack whose nodes are not
  yet registered; the manager's 409 is the backstop.
