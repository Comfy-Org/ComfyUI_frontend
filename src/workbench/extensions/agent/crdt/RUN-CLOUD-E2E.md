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
- Global Settings API access for the signed-in user and active workspace, so
  first-use Agent consent can be loaded and saved.
- The target workflow must be crdt-enabled (`workflows.crdt_enabled` is a per-workflow toggle).

## Run

    DEV_SERVER_COMFYUI_URL=https://pr-6711.testenvs.comfy.org/ pnpm dev

Any `*.comfy.org` `DEV_SERVER_COMFYUI_URL` auto-selects the cloud distribution and
proxies `/api` + `/ws` to that host, so no other flag is needed to retarget a
different ephemeral. The follower itself has no dedicated flag: it mounts with the
agent panel, whose visibility requires the product flag, open intent and saved
consent for the current user and workspace. Development mode forces the product
flag on; it does not bypass consent.

## Verify

- Click **Ask Comfy Agent**. On first use, choose **Start using Comfy Agent**
  and wait for the preference save to succeed and the composer to appear.
  If consent cannot load or save, resolve the authentication/API error and
  retry before checking the follower. Skip leaves Agent closed. Consent from
  another user or workspace does not satisfy the current scope.
- Open the CRDT debug instrument (`?crdtDebug=1`, rendered above the composer via
  `CrdtDevPanel`); its status row shows connected + the subscribed workflow id.
- Send a message in the agent chat; as the agent edits, `updatesApplied` increments and
  nodes move on the canvas.
- Reload the tab mid-session: it resubscribes and reconverges from the seeded snapshot.

## Also available: a hosted FE ephemeral

FE PR 15457 carries the `preview-gpu` + `retain-preview` labels, so it builds its own
preview environment; the follower runs when the Agent panel is open with its
product flag and consent requirements satisfied. For a local run use the
`pnpm dev` command above against a CRDT-on backend.
