# @comfyorg/test-recorder

Interactive CLI for recording and transforming Playwright browser tests for ComfyUI.

## Quick Start

**Prerequisites:** Node.js ≥ 20, pnpm, a running ComfyUI backend. See the [Browser Tests README](../../browser_tests/README.md) for detailed environment setup including Playwright installation and backend configuration.

```bash
pnpm comfy-test check       # Verify your environment is ready
pnpm comfy-test record      # Record a new test
pnpm comfy-test transform <file>  # Transform raw codegen to conventions
pnpm comfy-test list         # List available workflows
```

## For QA Testers

See the [Browser Tests README](../../browser_tests/README.md) for full setup instructions.

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
