# In-App Agent panel (FE-1187)

The In-App Agent panel is a manager-pattern workbench extension. The panel lives
entirely in this subtree and renders in a flag-gated right dock registered by
`src/extensions/core/agentPanel.ts`, so it shares the host pinia and vue-i18n
instances and wires every host dependency itself (REST client, `/ws` event source,
draft-to-canvas seam).

## CRDT follower POC

Set `VITE_AGENT_CRDT_FOLLOWER=true` to enable the experimental doc-host
follower at build time, or toggle it at runtime with `?agentCrdtFollower=1`
(persists to `localStorage['Comfy.Agent.CrdtFollower']` for the browser;
`?agentCrdtFollower=0` clears the opt-in). The runtime toggle exists so hosted
predeploy bundles — which are built without the env — can still enable the
follower per session without a rebuild. An explicit URL param wins over both
the persisted opt-in and the build flag for that page load. The follower uses
the existing same-origin `/ws` connection. To run against a cloud ephemeral
environment:

```bash
DEV_SERVER_COMFYUI_URL=https://<host>/ VITE_AGENT_CRDT_FOLLOWER=true pnpm dev
```

Incoming `doc_update` frames are decoded and applied incrementally with
`Y.applyUpdate`; the follower never requests or fans out a full document for
each update. Human `doc_ops` transmission is implemented, but converting local
canvas commands to the shared semantic op vocabulary remains intentionally
unwired until the `@comfyorg/comfy-multi-player` applier is available.
