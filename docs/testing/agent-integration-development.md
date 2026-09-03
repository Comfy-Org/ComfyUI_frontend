# Local agent integration development

Use this environment when changing the frontend, the in-workspace
`@comfyorg/comfy-multi-player` package, and the standalone agent backend together.
One foreground command starts the agent under Air and the frontend under Vite. Both
reload when their source changes, and stopping the command tears down both processes
and deletes the temporary agent database.

```diagram
┌──────────────────────────────┐
│ pnpm tsx dev-agent…          │
└───────────┬──────────────────┘
            ├──▶ Vite :6207 ─────▶ frontend + workspace package HMR
            │       │
            │       ├── /api, /ws ─────▶ ComfyUI :8188
            │       └── /api/agent ────▶ standalone agent :6286
            │
            └──▶ Air ── rebuild/restart ──▶ Comfy-Org/cloud/services/agent
```

## Start here

Three jobs. Replay needs only ComfyUI on 8188. The other two need `../cloud`,
`air` on PATH and `ANTHROPIC_API_KEY`; recording also needs `cloud up` running
in `../cloud`.

**1. Replay the recorded conversations as tests** (specs and recordings arrive
with [#16764](https://github.com/Comfy-Org/ComfyUI_frontend/pull/16764) and
[#16776](https://github.com/Comfy-Org/ComfyUI_frontend/pull/16776))

```bash
DISTRIBUTION=cloud DEV_SERVER_COMFYUI_URL=http://127.0.0.1:8188 pnpm dev
```

```bash
PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_TEST_URL=http://localhost:5173 DISTRIBUTION=cloud pnpm exec playwright test agentConversation --project=cloud
```

Add `--headed -g <case id>` to watch one.

**2. Run the real agent locally.** Not needed for replay, where the agent's side
is data. Do it to drive the real model with hot reload while changing agent or
panel code, to run the unmocked smoke, or as the first step of recording.

```bash
pnpm tsx scripts/dev-agent-integration.ts
```

It prints the frontend URL once the agent is healthy; Ctrl-C stops Vite and Air
and deletes the temporary SQLite directory; `--help` lists the path and port
overrides. In a second terminal, the unmocked smoke (any spec under
`browser_tests/tests/agent` runs the same way):

```bash
PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_TEST_URL=http://127.0.0.1:6207 pnpm exec playwright test agentHarnessSmoke --project=agent-harness
```

**3. Record a new conversation** (the recorder arrives with
[#16782](https://github.com/Comfy-Org/ComfyUI_frontend/pull/16782))

```bash
cd ../cloud && cloud up
```

```bash
AGENT_MODEL=claude-opus-5 COMFY_BIN=~/.local/bin/comfy pnpm tsx scripts/dev-agent-integration.ts --record --engine temporal --catalog <conversation fixture>
```

Paste the recorder command it prints, one `--prompt` per turn.

## Setup

1. Use Node 25 and install this repository with `pnpm install`.
2. Check out `Comfy-Org/cloud` next to this repository, or pass its location with
   `--cloud-repo`.
3. Install the agent's file watcher:

   ```bash
   go install github.com/air-verse/air@v1.67.4
   ```

4. Start a local ComfyUI backend at `http://127.0.0.1:8188`.
5. Export `ANTHROPIC_API_KEY`. `ANTHROPIC_BASE_URL` may be used instead for a local
   compatible model endpoint.

The root dependency on `@comfyorg/comfy-multi-player` must use `workspace:`. The
launcher refuses an npm pin or `pnpm link`, because either one would bypass the source
tree whose HMR behavior this environment exists to exercise.

## How it works

The Vite proxy keeps the standalone session token server-side. Browser REST and event
WebSocket traffic use same-origin `/api/agent` routes, while all other `/api` and `/ws`
traffic continues to reach ComfyUI.

### Modes

|                     | Standalone (no flag)                               | Record (`--record`)                                                                                |
| ------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| What runs           | frontend plus the agent alone: SQLite, no Docker   | the agent on the cloud repo's own local stack (`cloud up`): Postgres, Redis, the doc host it ships |
| Who uses it         | the dev loop; the smoke drives one real turn on it | whoever records a replay fixture                                                                   |
| Records graph edits | no: this configuration writes no per-op audit rows | yes                                                                                                |
| Cancels a turn      | no: the inline engine has no cancellation handle   | yes, with `--engine temporal`                                                                      |

## Glossary

- **Air:** the Go file watcher that rebuilds and restarts the local agent.
- **HMR:** hot module replacement; Vite updates frontend and workspace-package modules
  without a full development-server restart.
- **Standalone agent:** the Cloud repository's laptop mode, backed by local SQLite and
  an in-process event bus rather than Postgres, Redis, ingest, or Temporal.
- **Vite proxy:** the development-only same-origin bridge that forwards agent requests
  and injects the standalone session credential outside browser code.
