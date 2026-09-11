---
name: agent-integration-replay
description: 'Replay recorded agent conversations as Playwright tests against the real chat panel and canvas. Use when asked to replay agent recordings, run the agent replay suite, or debug an agent panel or graph-edit regression against a recording. Triggers on: replay agent conversation, agent replay suite, agent integration test.'
---

# Agent integration replay

One job: replay the recorded conversations as tests. Replay needs only a
ComfyUI backend on port 8188 and the dev server below. Recording a new
conversation is the recorder's job, documented in
`browser_tests/fixtures/data/agent/README.md`; the local stack launcher for
the real agent is proposed in #16781 and is not in this tree.

## Replay the recorded conversations as tests

Every JSON under `browser_tests/fixtures/data/agent/conversations/` is one
recorded conversation. The replay sends each recorded prompt through the real
chat panel, plays the agent's side back from the recording, applies the
recorded graph operations through the real multi-player library, and checks
the canvas and the panel after every turn.

```bash
DISTRIBUTION=cloud DEV_SERVER_COMFYUI_URL=http://127.0.0.1:8188 pnpm dev
```

```bash
pnpm comfy-test agent-replay
```

- On a terminal with no flags it asks which recording to replay and whether
  to watch it. Any flag, or a non-interactive stdin, runs without prompts.
- One case: `pnpm comfy-test agent-replay --case <case id> --headed` (the
  case id is the JSON file name without `.json`); `--video` records it under
  `test-results/`; `--url <origin>` points at a dev server other than
  `http://localhost:5173`; `--help` prints usage and runs nothing.
- Set `TEST_COMFYUI_DIR` to the ComfyUI install behind 8188 (or put it in
  `.env`) so the suite backs up and restores its user data.
- The command is a thin front for the raw invocation, which still works when
  the CLI is not available:

```bash
PLAYWRIGHT_TEST_URL=http://localhost:5173 DISTRIBUTION=cloud pnpm exec playwright test agentConversation --project=cloud
```

Add `--headed` to watch it and `RECORD_VIDEO=true` for video. For one
recording use `pnpm comfy-test agent-replay --case <case id>`.

- A failing replay names the turn and the assertion. Compare that turn's
  `response` entries with what the panel rendered; never edit a fixture to make
  a test pass.

## Conventions

- A fix that changes what the agent's ops do to the graph or the panel ships
  with a recording made before the fix, so it went red.
- Fixtures validate against `zAgentConversation` in
  `browser_tests/fixtures/data/agent/agentConversation.ts`; a schema change is
  versioned, never silent.
