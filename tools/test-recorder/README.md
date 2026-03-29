# @comfyorg/test-recorder

Interactive CLI for recording and transforming Playwright browser tests for ComfyUI.

## Usage

From the repo root:

```bash
pnpm comfy-test record     # Record a new test
pnpm comfy-test transform   # Transform raw codegen to conventions
pnpm comfy-test check       # Check environment prerequisites
pnpm comfy-test list        # List available workflows
```

## For QA Testers

See the [Browser Tests README](../../browser_tests/README.md) for full setup instructions.

## Development

```bash
cd tools/test-recorder
pnpm build     # Compile TypeScript
pnpm dev       # Watch mode
```
