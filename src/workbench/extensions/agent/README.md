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
  `/ws` carries neither. Its URL comes from `api.apiURL`, and the caller's
  credential rides as `?token=`, read again on every connect. Reconnects back
  off with jitter.
- **Identity, `GET /api/agent/identity`** (`services/agent/agentIdentity.ts`).
  Canvas ops carry `human:<user_id>:<tab>` with the id the backend reports,
  so the follower stays inactive until it answers.
- **Saved workflows, `GET /api/workflows`**. A saved tab the index does not
  name is refused with a retryable notice rather than sent without an id.
- **Credential** (`services/agent/agentAuth.ts`). Agent requests carry the
  signed-in user's auth header, or the stored API key when no one is signed in.
  A signed-out send opens the sign-in dialog. Signing out or switching account
  (or API key) reconnects the socket and looks the identity up again.

## Activation and consent

The dock is visible only when the `agent-in-app-experience` feature flag is
enabled, the panel has an open intent, and the current user and workspace have
accepted Agent consent. Development mode enables the feature flag; consent is
still required. A restored open intent cannot bypass consent.

On first use, click **Agent**, then **Start using Comfy Agent**.
Acceptance is stored through the hosted Global Settings API under
`Comfy.AgentPanel.ConsentAccepted` for the authenticated user and workspace.
Agent opens after the save succeeds. Skip, Escape and outside clicks dismiss
without saving; failed loads or saves keep the panel closed and allow retry.
Switching user or workspace invalidates the cached acceptance and loads the new
scope. Desktop/Local sign-in continuation authenticates before saving; this
branch currently mounts the Agent extension only in Cloud builds (FE-1931 owns
the remaining distribution entry points).

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
unanswered, or unreadable), turns seed the draft again; a reconnect retries the
document and withholds it until that attempt settles.
