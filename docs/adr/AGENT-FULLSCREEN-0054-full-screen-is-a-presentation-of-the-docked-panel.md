# ADR-AGENT-FULLSCREEN-0054: Full Screen Is a Presentation of the Docked Panel

Date: 2026-10-02

## Status

Proposed

## Context

The Comfy Agent panel docks beside the graph. Its maximize button used to
widen the dock to 960px, which still left the conversation in a column next to
the canvas. The redesigned chat wants a conversation that covers the whole
window while the agent keeps editing the workflow in the background, with
minimize returning to the docked layout.

The agent's edits depend on the live graph: the nodes it adds are created on
the canvas, and where a batch lands depends on the canvas's visible rectangle
([ADR-CRDT-PLACEMENT-0035](CRDT-PLACEMENT-0035-agent-inserted-nodes-land-near-existing-content.md)).
The owner's priority for this surface is reliability over cleverness: nothing
about how the graph renders or starts up may change. The redesign sits behind
the panel store's `experience` value, and the classic experience must stay as
it is while that value is `classic`.

## Decision

Full screen is a third presentation of the existing dock, next to docked and
the narrow-window overlay. It is not a new view.

1. **The same mounted panel covers the window.** `DockedAgentPanel.vue`
   already teleports itself to the page body as a fixed overlay when the window
   is too narrow to dock. Full screen uses that teleport with classes that
   cover the window. In graph mode the panel is not remounted between docked
   and full screen, so the session and the draft carry over. Moving the
   element resets scroll offsets, so the dock saves and restores them around
   the move.

2. **The size is one state.** The panel store holds the size as a single
   union (`docked`, `wide`, `fullscreen`) defined in `agentPanelSize.ts`. It
   changes only through that file's pure reducer, and a resolver derives the
   presentation from it. `wide` is the
   classic 960px maximize. The expand toggle reaches `fullscreen` only in the
   redesign. Closing the panel leaves full screen, so it reopens docked.

3. **The graph keeps running underneath.** It stays mounted, laid out and
   drawing exactly as it does behind the docked panel. The only change is that
   `.comfyui-body` in `GraphView.vue` is `inert` while covered, so it cannot
   take focus or clicks. Toasts and dialogs render outside that element and
   are unaffected.

4. **The graph host owns the panel while full screen is on.** `GraphCanvas.vue`
   normally mounts the dock in graph mode and `LinearView.vue` mounts it in
   app mode. While full screen is on, `GraphCanvas.vue` mounts it in both
   modes, including when the rest of the workspace UI is hidden, and
   `LinearView.vue` stands down. The teleport is what keeps the panel on
   screen in app mode, where the canvas container itself is hidden. Switching
   between graph-mode and app-mode workflows therefore does not remount a
   full-screen chat.

5. **The graph is covered only while the panel is mounted.** The store's
   `coversWorkspace` is true only when the presentation is full screen and the
   dock has reported itself mounted through `setPanelMounted`. A failed panel
   load calls `exitFullscreen('load_failed')`. Full screen can therefore never
   leave the user with an inert graph and no panel in front of it.

6. **`width` keeps meaning the docked width.** Camera framing subtracts the
   store's `width` from the canvas viewport (`visibleCanvasViewport`).
   Reporting the full-screen width there would save a wrong camera, so `width`
   keeps reporting the docked width during full screen, and leaving full
   screen returns to the width the user had dragged to.

### Alternatives considered

- **A separate view beside `LinearView` that hides the canvas container.** A
  hidden canvas reports zero sizes, so node sizes and the agent's node
  placement go stale while the chat is up. Every guard keyed to `linearMode`
  would need duplicating for the new view, and the chat would remount on each
  switch.
- **Building on App mode.** App mode is per-workflow state, so it changes when
  the agent opens another tab. Reusing it would also mark agent runs as
  app-mode runs in telemetry and write the mode into saved workflows.
- **Pausing or skipping graph rendering while covered, to save the work.** The
  rectangle the agent uses to place new nodes is only kept current by drawing
  and is zeroed on every workflow load, so pausing changes where nodes land,
  and those positions are saved. The fix needs several other pieces to change
  with it, and the owner chose reliability over the saving.

## Consequences

### Positive

- The agent's edits, node placement and camera framing behave in full screen
  as they do docked, and minimize shows the finished workflow immediately.
- Entering and leaving full screen in graph mode keeps the same chat instance.
- The classic experience is untouched while the flag is off: maximize still
  widens the dock to 960px and `fullscreen` is never reached.
- A panel that fails to load cannot leave the window blank.

### Negative

- The graph keeps its normal cost while covered. Nothing is saved by hiding it.
- Entering or leaving full screen on an app-mode workflow re-hosts the panel
  between `LinearView.vue` and `GraphCanvas.vue`, the way a mode switch does
  today.
- Global key handling needs care while the graph is covered. `inert` stops
  focus and clicks but promises nothing about where keyboard events go, so
  window-level graph key handling needs its own guard. That work is a
  follow-up in the same project.

## Notes

Related decisions:
[ADR-CRDT-PLACEMENT-0035](CRDT-PLACEMENT-0035-agent-inserted-nodes-land-near-existing-content.md)
defines the viewport-aware placement that pausing rendering would disturb, and
[ADR-CANVAS-INTERACTION-0035](CANVAS-INTERACTION-0035-agent-node-picking-policy.md)
uses `inert` the same way for the layers above the canvas.

The store rules are pinned by `agentPanelSize.test.ts` and
`agentPanelStoreFullscreen.test.ts`; the dock by `DockedAgentPanel.test.ts`
and `dockedAgentPanelLoadFailure.test.ts`.
