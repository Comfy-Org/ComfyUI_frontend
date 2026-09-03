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

    DEV_SERVER_COMFYUI_URL=https://pr-6711.testenvs.comfy.org/ pnpm dev

Any `*.comfy.org` `DEV_SERVER_COMFYUI_URL` auto-selects the cloud distribution and
proxies `/api` + `/ws` to that host, so no other flag is needed to retarget a
different ephemeral. The follower itself has no dedicated flag: it mounts with the
agent panel, so the panel's product flag is the only gate.

## Verify

- The status strip at the top of the agent panel (`data-testid="agent-crdt-status"`)
  shows connected + the subscribed workflow id. The strip and the CrdtDevPanel below
  it are DEV-only (`import.meta.env.DEV`), so they render under `pnpm dev` but not in
  a production build such as a hosted preview; there, verify through the canvas
  updates below and the `/ws` frames in the network tab instead.
- Send a message in the agent chat; as the agent edits, `updatesApplied` increments and
  nodes move on the canvas.
- Reload the tab mid-session: it resubscribes and reconverges from the seeded snapshot.

## Also available: a hosted FE ephemeral

FE PR 15457 carries the `preview-gpu` + `retain-preview` labels, so it builds its own
preview environment; with the agent panel's product flag on there, the follower runs
too. For a local run use the `pnpm dev` command above against a CRDT-on backend.
