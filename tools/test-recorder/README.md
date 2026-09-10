# @comfyorg/test-recorder

Interactive CLI for recording and transforming Playwright browser tests for ComfyUI.

## Quick Start

**Prerequisites:** Node.js version matching this repo's `engines` field in `package.json`, pnpm, a running ComfyUI backend. See the [Browser Tests README](../../browser_tests/README.md) for detailed environment setup including Playwright installation and backend configuration.

```bash
pnpm comfy-test check       # Verify your environment is ready
pnpm comfy-test record      # Record a new test interactively (needs a real terminal)
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

Record flags:

- `--distribution <cloud|cloud-staging|cloud-prod|local>` selects the backend environment.
- `--backend <url>` connects to a custom backend and implies a custom distribution.
- `--workflow <name>`, `--tags <a,b>`, and `--feature-flags <key:value,...>` configure the recording.
- `--use-case <reproduce-bug|verify-change|test-plan-step|contribute>`, `--description <text>`, and `--name <slug>` describe and name it.
- `--pr <number>` checks whether the checkout matches a PR and offers to switch safely. It never switches a checkout with uncommitted changes.

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
