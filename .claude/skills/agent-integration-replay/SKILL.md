---
name: agent-integration-replay
description: 'Run the agent integration suite: replay recorded agent conversations as Playwright tests, run the real agent locally with hot reload, or record a new conversation into a replay fixture. Use when asked to replay agent recordings, run the agent replay suite, record an agent conversation, debug an agent panel or graph-edit regression against a recording, or add replay coverage for an agent bug fix. Triggers on: replay agent conversation, agent replay suite, record agent conversation, agent integration test, local agent harness.'
---

# Agent integration replay

Three jobs, each one command pair. The playbook with the setup and the
glossary is `docs/testing/agent-integration-development.md`; this skill is the
short form for an agent that already has a checkout.

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
PLAYWRIGHT_LOCAL=1 PLAYWRIGHT_TEST_URL=http://localhost:5173 DISTRIBUTION=cloud pnpm exec playwright test agentConversation --project=cloud
```

- Watch one case: add `--headed -g <case id>` (the case id is the JSON file
  name without `.json`).
- Set `TEST_COMFYUI_DIR` to the ComfyUI install behind 8188 (or put it in
  `.env`) so the suite backs up and restores its user data.
- Video: set `RECORD_VIDEO=true`; Playwright writes the recording under
  `test-results/`.
- A failing replay names the turn and the assertion that failed. Compare the
  recording's `response` entries for that turn with what the panel rendered
  before touching the fixture; the fixture is data, never edit it by hand to
  make a test pass.

## 2. Run the real agent locally

Not needed for replay. Use it to drive the real model with hot reload while
changing agent or panel code, to run the unmocked smoke, or as the first step
of recording.

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

Recording drives the real local agent on the cloud repo's full stack (the doc
host and the Postgres audit rows are what make the recording trustworthy, so
standalone mode cannot record).

```bash
cd ../cloud && cloud up
```

```bash
AGENT_MODEL=claude-opus-5 COMFY_BIN=~/.local/bin/comfy pnpm tsx scripts/dev-agent-integration.ts --record --engine temporal --catalog <seed fixture json>
```

The launcher prints the recorder command with the environment filled in.
Paste it, adding one `--prompt "<text>"` per turn and `--out <fixture path>`;
for a cancelled turn add `--cancel-turn <k> --cancel-after-ms <n>`. The
recorder refuses the recording, with the reason, when the socket stream never
opened, a turn was not accepted, an applied operation is missing from the tool
result, or a cancel was not acknowledged; fix the cause and re-run rather than
editing the output.

Then replay the new case alone (job 1 with `-g <case id>`) before committing
it. Name the case after the behavior it pins, `agent-rec-<behavior>`.

## Conventions

- One recording per agent bug fix: a fix that changes what the agent's ops do
  to the graph or the panel ships with a recording that failed before the fix.
  See `browser_tests/fixtures/data/agent/README.md`.
- Fixtures validate against `zAgentConversation` in
  `browser_tests/fixtures/data/agent/agentConversation.ts`; a schema change is
  a versioned change, never a silent one.
- Never run the record-mode stack while another recording session has it up;
  check ports 8086, 5173 and 6207 first.
