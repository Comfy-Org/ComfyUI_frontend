# @comfyorg/test-recorder

Interactive CLI for recording and transforming Playwright browser tests for ComfyUI.

## Quick Start

**Prerequisites:** Node.js version matching this repo's `engines` field in `package.json`, pnpm, a running ComfyUI backend. See the [Browser Tests README](../../browser_tests/README.md) for detailed environment setup including Playwright installation and backend configuration.

```bash
pnpm comfy-test check       # Verify your environment is ready
pnpm comfy-test record      # Record a new test interactively (alias: recorder; needs a real terminal)
pnpm comfy-test plan --description "<what to test>"  # Non-interactive: print a plan for an agent to hand to playwright-test-generator
pnpm comfy-test transform <file>  # Transform raw codegen to conventions
pnpm comfy-test pr <file>   # Open a PR for a generated test
pnpm comfy-test list        # List available workflows
```

## For QA Testers

See the [Browser Tests README](../../browser_tests/README.md) for full setup instructions.

A test plan can prefill every setup answer in one copy-pastable command:

```bash
pnpm comfy-test record --distribution cloud --workflow default --tags @canvas,@widget --feature-flags linear_toggle_enabled:true --use-case test-plan-step --description "seed stays fixed across runs" --name fixed-seed
```

Supplied answers are confirmed and their prompts are skipped. Invalid values
show a warning and return to the corresponding prompt.

`pnpm comfy-test recorder` is an alias of `pnpm comfy-test record`; both accept
the same flags.

Record flags:

- `--distribution <cloud|cloud-staging|cloud-prod|local>` selects the backend environment.
- `--backend <url>` connects to a custom backend and implies a custom distribution.
- `--workflow <name>`, `--tags <a,b>`, and `--feature-flags <key:value,...>` configure the recording.
- `--use-case <reproduce-bug|verify-change|test-plan-step|contribute>`, `--description <text>`, and `--name <slug>` describe and name it.
- `--pr <number>` verifies the checkout revision before recording and offers to switch safely. It fails closed when the PR cannot be verified, never switches a checkout with uncommitted changes, and only continues on another checkout when you explicitly choose that fallback.

The distribution selector fetches and displays the currently deployed backend
version for each cloud environment. `comfy-test check --distribution <id>`
prints the same backend, ComfyUI, and deployment-environment information.

Cloud recordings pass feature flags as repeatable `?ff=name:value` URL
parameters. These overrides are scoped to the opened browser tab and disappear
when it closes. Local recordings continue to seed the existing `ff:<name>`
local-storage overrides through the test fixture.

## For Agents

`record` requires an interactive terminal and a human clicking a real
browser — it refuses to run under non-TTY stdin. Use `plan` instead:
non-interactive, no browser, no backend/dev-server dependency (it only
reads the filesystem and prints text). It validates your tags/workflow
and prints a plan block ready to hand to the `playwright-test-generator`
agent (`.claude/agents/playwright-test-generator.md`), which writes a
convention-compliant spec directly — then `comfy-test pr <file>` opens
the PR. See [Browser Tests README § For agents](../../browser_tests/README.md#for-agents)
for the full chain.

`agent-replay` runs the recorded agent conversations as tests against a
running dev server. On a terminal with no flags it asks which recording to
replay and whether to watch it; `--case <id>` narrows to one recording,
`--headed` shows it, `--video` records it, and `--help` prints usage without
running anything. `--spec <path>` replays the recordings through a spec other
than the default `agentConversation` ones — anything that asserts something
else about the same recordings, such as rendered node geometry, is reachable
through the CLI rather than a hand-written Playwright invocation. A spec
answers `--case` when it titles its cases `recorded <case id>`, the
convention `browser_tests/tests/agent/agentConversationReplay.spec.ts`
follows. The replay workflow is in
`.claude/skills/agent-integration-replay/SKILL.md`.

## Development

```bash
cd tools/test-recorder
pnpm build     # Compile TypeScript
pnpm dev       # Watch mode
```

Run unit tests from the repo root:

```bash
pnpm test:unit -- tools/test-recorder
```
