# In-App Agent panel (FE-1187)

The In-App Agent panel is a manager-pattern workbench extension. The panel lives
entirely in this subtree and renders in a right dock registered by
`src/extensions/core/agentPanel.ts`, so it shares the host pinia and vue-i18n
instances and wires every host dependency itself (REST client, `/ws` event source,
draft-to-canvas seam).

## Activation and consent

The dock is visible only when the `agent-in-app-experience` feature flag is
enabled, the panel has an open intent, and the current user and workspace have
accepted Agent consent. Development mode enables the feature flag; consent is
still required. A restored open intent cannot bypass consent.

On first use, click **Ask Comfy Agent**, then **Start using Comfy Agent**.
Acceptance is stored through the hosted Global Settings API under
`Comfy.AgentPanel.ConsentAccepted` for the authenticated user and workspace.
Agent opens after the save succeeds. Skip, Escape and outside clicks dismiss
without saving; failed loads or saves keep the panel closed and allow retry.
Switching user or workspace invalidates the cached acceptance and loads the new
scope. Desktop/Local sign-in continuation authenticates before saving; this
branch currently mounts the Agent extension only in Cloud builds (FE-1931 owns
the remaining distribution entry points).

## CRDT follower

The doc-host follower has no gate of its own: it mounts with the agent panel,
so it runs only once the panel's activation and consent requirements above are
satisfied.
The follower uses the existing same-origin `/ws` connection. To run against a
cloud ephemeral environment:

```bash
DEV_SERVER_COMFYUI_URL=https://<host>/ pnpm dev
```

Incoming `doc_update` frames are decoded and applied incrementally with
`Y.applyUpdate`; the follower never requests or fans out a full document for
each update. Human `doc_ops` transmission is implemented, but converting local
canvas commands to the shared semantic op vocabulary remains intentionally
unwired until the `@comfyorg/comfy-multi-player` applier is available.
