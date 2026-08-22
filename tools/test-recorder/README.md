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
