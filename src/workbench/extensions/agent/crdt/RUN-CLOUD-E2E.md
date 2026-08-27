# Cloud CRDT follower — run sheet

Point this branch's follower at a CRDT-enabled cloud backend and watch the agent's
graph edits land on the canvas.

## What this proves

Agent turn (backend) -> semantic ops -> doc-host applier -> host Yjs `update_b64`
-> relayed over `/ws` -> FE follower Y.Doc -> `layoutStore` -> canvas moves. The
follower is read-only: it never writes the shared doc (host is the sole writer).

## Prerequisites

- A backend ephemeral with the CRDT path on (doc-host sidecar + `AGENT_CRDT_MODE=on`).
  Kishore's integration PR ephemeral has this: pr-6711.testenvs.comfy.org
- Network reachability to that host (allowlist-gated; run from a machine that can reach `*.testenvs`).
- A logged-in session / API key (the agent API returns 401 otherwise).
- The target workflow must be crdt-enabled (`workflows.crdt_enabled` is a per-workflow toggle).

## Run

    DEV_SERVER_COMFYUI_URL=https://pr-6711.testenvs.comfy.org/ pnpm dev:cloud:crdt

`dev:cloud:crdt` sets `VITE_AGENT_CRDT_FOLLOWER=true` (build-time gate; the code checks
for the exact string `true`, so `1` or `on` will NOT enable it). Any `*.comfy.org`
`DEV_SERVER_COMFYUI_URL` auto-selects the cloud distribution and proxies `/api` + `/ws`
to that host, so no other flag is needed to retarget a different ephemeral.

Alternatively (R1a), any built bundle — including one built WITHOUT the env — can
enable the follower at runtime: open the app with `?agentCrdtFollower=1`. The opt-in
persists in `localStorage['Comfy.Agent.CrdtFollower']` until cleared with
`?agentCrdtFollower=0`. See `followerGate.ts`.

## Verify

- The status strip at the top of the agent panel (`data-testid="agent-crdt-status"`)
  shows connected + the subscribed workflow id.
- Send a message in the agent chat; as the agent edits, `updatesApplied` increments and
  nodes move on the canvas.
- Reload the tab mid-session: it resubscribes and reconverges from the seeded snapshot.

## Also available: a hosted FE ephemeral

FE PR 15457 carries the `preview-gpu` + `retain-preview` labels, so it builds its own
preview environment. Note that the preview's FE bundle is built WITHOUT
`VITE_AGENT_CRDT_FOLLOWER`, so the follower is inert there; that env is for exercising
the rest of the agent panel, not the CRDT follow path. For the follow path use the
`pnpm dev:cloud:crdt` command above against a CRDT-on backend.
