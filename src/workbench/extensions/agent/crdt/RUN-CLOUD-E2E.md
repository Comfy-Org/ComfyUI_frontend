# Cloud CRDT follower - run sheet

Point this branch's follower at a CRDT-enabled cloud backend and watch the agent's
graph edits land on the canvas.

Note: at this slice the follower has no mount site - nothing in the app imports
this tree yet, and the agent panel that mounts it lands in a later slice. Until
then the Verify section below cannot be executed from a build of this branch; the
sheet documents the procedure for the slice that ships the mount.

## What this proves

Agent turn (backend) -> semantic ops -> doc applier -> host Yjs `update_b64`
-> relayed over `/ws` -> FE follower Y.Doc -> `layoutStore` -> canvas moves. The
follower is read-only: it never writes the shared doc (host is the sole writer).

## Prerequisites

- A backend with the CRDT document path enabled.
- Network reachability to that backend from the machine running the dev server.
- A logged-in session / API key (the agent API returns 401 otherwise).
- The target workflow must be crdt-enabled on the backend.

## Run

    DEV_SERVER_COMFYUI_URL=https://<your-crdt-enabled-backend>/ pnpm dev

Any `*.comfy.org` `DEV_SERVER_COMFYUI_URL` auto-selects the cloud distribution and
proxies `/api` + `/ws` to that host, so no other flag is needed to retarget a
different backend. The follower itself has no dedicated flag: it mounts with the
agent panel, so the panel's product flag is the only gate.

## Verify (requires the agent-panel slice that mounts the follower)

- Click the CRDT dev chip (bottom right, dev builds only) to open the panel;
  the Live status table shows connected: yes and the subscribed workflow id in
  the doc id row.
- Send a message in the agent chat; as the agent edits, `updatesApplied` increments and
  nodes move on the canvas.
- Reload the tab mid-session: it resubscribes and reconverges from the seeded snapshot.
