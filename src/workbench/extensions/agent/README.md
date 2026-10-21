# In-App Agent panel (FE-1187)

The In-App Agent panel is a manager-pattern workbench extension. The panel lives
entirely in this subtree and renders in a right dock registered by
`src/extensions/core/agentPanel.ts`, so it shares the host pinia and vue-i18n
instances and wires every host dependency itself (REST client, agent events
socket, draft-to-canvas seam).

## Backend contract

The panel speaks one contract on the cloud and on the local agent:

- **Events socket, `/api/agent/events`** (`services/agent/agentEventSource.ts`).
  Agent events and CRDT doc frames share it in both directions; ComfyUI's
  `/ws` carries neither. Its URL comes from `api.apiURL`. In the cloud it
  takes the auth params `/ws` uses, and does not open when no one is signed
  in; elsewhere the signed-in user's credential rides as `?token=`. Both are
  read again on every connect. Reconnects back off with jitter; the backoff
  resets once a socket delivers a frame or stays open for the maximum delay.
- **Identity, `GET /api/agent/identity`** (`services/agent/agentIdentity.ts`).
  Canvas ops carry `human:<user_id>:<tab>` with the id the backend reports,
  so the follower stays inactive until it answers. A failed lookup retries
  with backoff, capped at 30 seconds and never given up, and at once when the
  socket connects again. A rejected credential is not retried until the
  account changes.
- **ComfyUI restart** (`stores/agent/agentNodeDefinitionRefreshStore.ts`). A
  successful `restart_comfyui` tool call refreshes node definitions and then
  reloads the open workflow; the refresh shows its own "Update requested" and
  "Node definitions updated" toasts. A failed refresh runs again only when
  ComfyUI's `/ws` reconnects later; until then definitions stay stale, and
  **Refresh Node Definitions** recovers them. A restart made while the panel is
  closed is not observed.
- **Saved workflows, `GET /api/workflows`**. Saved tabs resolve through the
  saved-workflow index on every backend.
- **Credential** (`services/agent/agentAuth.ts`). In the cloud, agent requests
  authenticate through `api.fetchApi` like every other request. Elsewhere they
  carry the signed-in user's auth header, or the stored API key when no one is
  signed in, and a running turn re-sends it. A signed-out send opens the sign-in
  dialog, unless the dev proxy injects `DEV_AGENT_COMFY_TOKEN`. Signing out or
  switching account (or API key) reconnects the socket and looks the identity
  up again.

## Activation and consent

The dock is visible only when the server's `agent` feature reports
`state: "ready"`, the panel has an open intent, and the current user and
workspace have accepted Agent consent. Cloud and ComfyUI (`--enable-agent`)
publish the same feature, and ComfyUI pushes `agent_status` when it changes;
while it is `starting` or `failed` the entry button shows that, inert. Builds
with `VITE_AGENT_STANDALONE=true` (the local agent harness) ignore the feature
and, in development mode, force the panel on; consent is still required. A
plain `pnpm dev` shows the panel only when the ComfyUI it proxies publishes the
feature. A restored open intent cannot bypass consent.

On first use, click **Agent**, then **Start using Comfy Agent**.
Acceptance is stored through the hosted Global Settings API under
`Comfy.AgentPanel.ConsentAccepted` for the authenticated user and workspace.
Agent opens after the save succeeds. Skip, Escape and outside clicks dismiss
without accepting. Skip stores an account preference that suppresses future
automatic offers; Escape and outside clicks do not. An explicit Send can offer
consent again. Failed loads or saves keep the panel closed and allow retry.
Switching user or workspace invalidates the cached acceptance and loads the
new scope. Desktop/Local sign-in continuation authenticates before saving.

## First-use tour

After consent succeeds, the first Agent open starts a four-card tour of the
panel, composer, graph and chat history. **Next** advances through the cards;
**Done** on the last card, **Skip** on any card and Escape once a card is on
screen all dismiss the tour and mark it complete.

Completion is device-local in `localStorage`, scoped to the authenticated user
and active workspace; with either unresolved there is no scope to record, so no
tour is shown at all. It does not sync through Global Settings. A different
user or workspace on the same device gets its own tour. The legacy unscoped
completion flag is adopted once by the current scope, then removed.

The tour waits rather than marking itself complete when its target is not yet
available. It is also deferred while App Mode is active or another onboarding
tour owns the overlay; returning to graph mode or finishing the other tour lets
the Agent tour appear.

## CRDT follower

The doc-host follower has no gate of its own: it mounts with the agent panel,
so it runs only once the panel's activation and consent requirements above are
satisfied.
The follower's doc frames ride the events socket
(`crdt/agentDocFrameTransport.ts`), and every open of that socket resubscribes.
The dev server proxies `/api/agent/events` as a WebSocket. To run against a
cloud ephemeral environment:

```bash
DEV_SERVER_COMFYUI_URL=https://<host>/ pnpm dev
```

Incoming `doc_update` frames are decoded and applied incrementally with
`Y.applyUpdate`; the follower never requests or fans out a full document for
each update. Human edits are minted into the shared op vocabulary and sent as
`doc_ops` frames on the same socket (`crdt/docOpMinter.ts`).

While the follower holds the bound document, a turn sends no draft: the
document is the source of truth and an unversioned draft would overwrite it.
Once the follower gives up on that document (refused for good, every subscribe
unanswered, or unreadable), or the identity lookup is rejected, turns seed the
draft again. An identity lookup that is still retrying keeps withholding the
draft. A reconnect retries the document and withholds it until that attempt
settles.

## Ask cards

An `ask_user` question stays on screen, read-only, after it resolves, until
the thread is loaded again. The server's transcript keeps only a pending ask
(`pending_ask`), so a reload, or opening another chat and coming back, drops a
card whose ask has resolved.
