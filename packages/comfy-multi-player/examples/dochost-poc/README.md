# dochost CRDT POC harness

A small **no-mock** harness that drives the **real** doc-host sidecar (from
`Comfy-Org/cloud`, `services/agent/dochost`) running the **real** applier in this package,
so you can watch a workflow document converge from ops + deltas without standing up the whole
cloud. It is a backend/protocol proof, **not** a live multiplayer demo.

> This example is a shareable way to exercise and reason about the V1 document-semantics path.
> It is not wired into CI.

## What is real vs. absent

| Piece | Here | Notes |
| --- | --- | --- |
| Applier / merge / projection / mint | **REAL** | this package (`@comfyorg/comfy-multi-player`) |
| doc-host sidecar server | **REAL** | `services/agent/dochost/src/server.ts` from cloud main |
| HTTP transport (mint/apply/project) | **REAL** | loopback `127.0.0.1:8095`, same as in-pod |
| Follower integration | **REAL** | a real `Y.Doc` fold of `snapshot + host deltas` (raw-struct fan-out) |
| Widget catalog / base graph / ops | **REAL fixtures + frozen op shapes** | `fixtures/catalog.json`, `fixtures/session-edit-heavy.session.jsonl` |
| Go agent, ingest relay, Redis, Postgres, Temporal, auth | **absent** | transport + persistence around the core, not doc semantics |
| Browser, `/ws` WebSocket, litegraph | **absent** | no FE doc-frame client exists yet |

The document-semantics path is 100% real; the networking + browser + persistence shell is
simply not part of this slice. Nothing is stubbed.

## What it proves (all green)

1. concurrent human `set_widget(seed)` and agent `add_node(CLIPTextEncode)+connect` both land;
2. a follower that applied **only** the host's incremental Yjs deltas converges to the host
   projection (raw-struct fan-out; convergence is projection-equality, per schema §2.5);
3. redelivering a delta is a no-op (idempotency);
4. deltas integrate order-independently at the follower.

## Run it

You need a checkout of `Comfy-Org/cloud` main for the doc-host sidecar source at
`services/agent/dochost`. Then one command builds both halves, starts the sidecar, and drives it:

```bash
DOCHOST_SRC=/path/to/cloud-main/services/agent/dochost ./examples/dochost-poc/run.sh
# -> ALL GREEN: 7 passed, 0 failed
```

`services/agent/dochost/package.json` depends on the published npm-registry package
`@comfyorg/comfy-multi-player@0.1.0`, so its `npm ci` pulls the published applier. This harness's
fixtures come from the local build of this repo; `0.1.0` matches this repo at the publish point,
so the projection-equality check covers that local-build/published-package boundary.

Manual equivalent, if you'd rather not use the script:

```bash
npm ci && npm run build                                   # 1. build the applier (this repo)
( cd "$DOCHOST_SRC" && npm ci && npm run build )          # 2. build the sidecar
# Yjs must be a SINGLE instance — a nested second copy breaks Yjs instanceof checks and makes
# project() throw "could not be cloned". npm ci dedupes; if you used a file: link, also:
rm -rf "$DOCHOST_SRC/node_modules/@comfyorg/comfy-multi-player/node_modules/yjs"
PORT=8095 node "$DOCHOST_SRC/dist/server.js" &           # 3. start sidecar
node examples/dochost-poc/dochost-driver.mjs             # 4. drive it (fixtures read from this repo)
```

Env: `DOC_HOST` (default `http://127.0.0.1:8095`), `CMP_PIN` (default = repo root, for fixtures),
`PORT` (default `8095`).

## What it is NOT

Not a live multiplayer session and not something your laptop can join over the network. A true
"team connects to the graph and watches the agent edit" demo additionally needs: an FE `/ws`
doc-frame client + Follower `Y.Doc` + litegraph bridge (none on any branch yet); the Go agent +
ingest relay + Redis actually running; and a network-reachable endpoint. Those are where the
integration risk now lives.
