---
name: agent-integration-replay
description: 'Run the agent integration suite: replay recorded agent conversations as Playwright tests, run the real agent locally with hot reload, or record a new conversation into a replay fixture. Use when asked to replay agent recordings, run the agent replay suite, record an agent conversation, debug an agent panel or graph-edit regression against a recording, or add replay coverage for an agent bug fix. Triggers on: replay agent conversation, agent replay suite, record agent conversation, agent integration test, local agent harness.'
---

# Agent integration replay

Four jobs. Setup and glossary: `docs/testing/agent-integration-development.md`.

Replay needs only a ComfyUI backend on port 8188. Running the agent and
recording need the cloud repo checked out beside this one as `../cloud`, `air`
on PATH, and `ANTHROPIC_API_KEY` in the environment; recording also needs
`cloud up` running in `../cloud`.

## 1. Replay the recorded conversations as tests

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

- One case: `pnpm comfy-test agent-replay --case <case id> --headed` (the
  case id is the JSON file name without `.json`); `--video` records it under
  `test-results/`; `--url <origin>` points at a dev server other than
  `http://localhost:5173`.
- Set `TEST_COMFYUI_DIR` to the ComfyUI install behind 8188 (or put it in
  `.env`) so the suite backs up and restores its user data.
- The command is a thin front for the raw invocation, which still works when
  the CLI is not available:

```bash
PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_TEST_URL=http://localhost:5173 DISTRIBUTION=cloud pnpm exec playwright test agentConversation --project=cloud
```

Add `--headed -g <case id>` to watch one and `RECORD_VIDEO=true` for video.

- A failing replay names the turn and the assertion. Compare that turn's
  `response` entries with what the panel rendered; never edit a fixture to make
  a test pass.

## 2. Run the real agent locally

For driving the real model with hot reload, the unmocked smoke, or as the
first step of recording.

```bash
pnpm tsx scripts/dev-agent-integration.ts
```

It prints the frontend URL once the agent is healthy; Ctrl-C stops Vite and
Air and deletes the temporary SQLite directory; `--help` lists the path and
port overrides. In a second terminal, the unmocked smoke:

```bash
PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_TEST_URL=http://127.0.0.1:6207 pnpm exec playwright test agentHarnessSmoke --project=agent-harness
```

## 3. Record a new conversation

Recording needs the cloud repo's full stack: the doc host and the Postgres
audit rows are what make a recording trustworthy, so standalone mode cannot
record.

```bash
cd ../cloud && cloud up
```

```bash
AGENT_MODEL=claude-opus-5 COMFY_BIN=~/.local/bin/comfy pnpm tsx scripts/dev-agent-integration.ts --record --engine temporal --catalog <seed fixture json>
```

The launcher prints the recorder command with the environment filled in.
Paste it with one `--prompt "<text>"` per turn and `--out <fixture path>`;
`--cancel-turn <k> --cancel-after-ms <n>` cancels a turn mid-stream;
`--work <dir>` moves the provenance sidecars out of `recordings/`. A refused
recording names its gate; fix the cause and re-run, never edit the output.

Then replay the new case alone (`pnpm comfy-test agent-replay --case <case id>`)
before committing
it. Name the case after the behavior it pins, `agent-rec-<behavior>`.

## 4. Import a Langfuse session

A conversation that already ran on a hosted agent becomes a fixture from its
trace (arrives with #17018):

```bash
AGENT_CLOUD_SHA=<cloud sha> pnpm exec tsx scripts/agentConversationFromLangfuse.ts <caseId> <seedFixture.json> --trace <traceId> --workflow <cloudWorkflowId> --out <fixture path>
```

`--session <sessionId>` takes a whole session. Credentials come from
`~/.config/comfy-agent/langfuse.env`; the audit rows still come from that
environment's Postgres (`AGENT_PG_EXEC`), so the database must be reachable.
Then replay the case (job 1) to see the session in the UI, with `--video` for
a recording. Details: `browser_tests/fixtures/data/agent/README.md`.

## Conventions

- A fix that changes what the agent's ops do to the graph or the panel ships
  with a recording made before the fix, so it went red.
- Fixtures validate against `zAgentConversation` in
  `browser_tests/fixtures/data/agent/agentConversation.ts`; a schema change is
  versioned, never silent.
- Never bring the record-mode stack up while another session has it up; check
  ports 8086, 5173 and 6207 first.
