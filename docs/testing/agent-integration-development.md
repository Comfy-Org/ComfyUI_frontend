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

## Run and stop

From the frontend checkout:

```bash
pnpm tsx scripts/dev-agent-integration.ts --cloud-repo ../cloud
```

The command prints the frontend URL after the standalone agent is healthy. Press
Ctrl-C once to stop Vite and Air and remove the temporary SQLite data directory. Run
`pnpm tsx scripts/dev-agent-integration.ts --help` to override the frontend, agent,
ComfyUI, Cloud checkout, or Air paths.

The Vite proxy keeps the standalone session token server-side. Browser REST and event
WebSocket traffic use same-origin `/api/agent` routes, while all other `/api` and `/ws`
traffic continues to reach ComfyUI.

## Modes

|                     | Standalone (no flag)                               | Record (`--record`)                                                                                |
| ------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| What runs           | frontend plus the agent alone: SQLite, no Docker   | the agent on the cloud repo's own local stack (`cloud up`): Postgres, Redis, the doc host it ships |
| Who uses it         | the dev loop; the smoke drives one real turn on it | whoever records a replay fixture                                                                   |
| Records graph edits | no: this configuration writes no per-op audit rows | yes                                                                                                |
| Cancels a turn      | no: the inline engine has no cancellation handle   | yes, with `--engine temporal`                                                                      |

## Playwright entrypoint

Leave the environment running, then use a second terminal:

```bash
PLAYWRIGHT_LOCAL=1 \
PLAYWRIGHT_TEST_URL=http://127.0.0.1:6207 \
pnpm exec playwright test browser_tests/tests/agent
```

Pass a narrower spec or `--headed` after the directory as needed. Playwright traces,
screenshots, and videos follow the repository's normal `browser_tests` configuration.

## Glossary

- **Air:** the Go file watcher that rebuilds and restarts the local agent.
- **HMR:** hot module replacement; Vite updates frontend and workspace-package modules
  without a full development-server restart.
- **Standalone agent:** the Cloud repository's laptop mode, backed by local SQLite and
  an in-process event bus rather than Postgres, Redis, ingest, or Temporal.
- **Vite proxy:** the development-only same-origin bridge that forwards agent requests
  and injects the standalone session credential outside browser code.
