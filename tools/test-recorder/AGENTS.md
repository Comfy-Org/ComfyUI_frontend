# Test Recorder Guidance

## Dual-audience contract

Every `comfy-test` capability MUST be reachable both interactively through
Clack prompts for humans and non-interactively through subcommands, flags, or
environment variables for automation. When adding or changing a feature,
implement and document both paths. A prompt-only or flag-only feature is
incomplete.

## Interface parity

| Capability             | Interactive `record` path                    | Non-interactive path                                                                         |
| ---------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Target distribution    | Distribution selector                        | `check --distribution <id>` or `COMFY_TEST_DISTRIBUTION`                                     |
| Custom backend         | “Custom backend…” selection and URL prompt   | `check --backend <url>` or `COMFY_TEST_BACKEND`                                              |
| Workflow search        | Searchable workflow autocomplete             | `list --filter <keyword>`                                                                    |
| Add workflow from file | “(add from file…)” workflow option           | `add-workflow <file> [--name <n>]`                                                           |
| Test tags              | Tag multiselect with hints                   | `tags` lists the registry with descriptions; `plan --tags` and `transform --tags` apply tags |
| Feature flags          | Feature-flag selector and custom flag prompt | `plan --feature-flags <specs>` or `transform --feature-flags <specs>`                        |
| Secret scrubbing       | Automatic during `record`, with a loud alert | Automatic in `transform <file>`; findings print as 🔒 lines in the summary                   |

## Distribution-aware recording template

The `comfyPage` fixture boots through OSS-only devtools APIs
(`/api/devtools/set_settings` etc.) that cloud backends don't serve, so the
recording template branches on the selected distribution
(`recordingTarget` in `src/recorder/template.ts`):

- **local** — full `comfyPage` template: workflow pre-load, `test.use({
initialFeatureFlags })`.
- **cloud / cloud-staging / cloud-prod / custom** — bare-page template:
  `page.goto(PLAYWRIGHT_TEST_URL)` and the recorder enabled immediately —
  no boot gate, so a sign-in screen can't stall the Inspector (sign in
  manually, then record). Feature flags are seeded via `ff:<key>`
  localStorage entries (the same mechanism as `FeatureFlagHelper.seedFlags`).
  Workflow pre-load is unsupported; `record` warns and the human loads it
  in the app.

The transformed output test always uses the `comfyPage` harness and runs
against the local backend in CI — a cloud recording captures selectors and
flows; it is not a test that replays against cloud as-is.

## Package conventions

- Keep reusable logic in importable pure functions and cover it with focused
  unit tests.
- Use TypeScript with precise types; never use `any` or `as any`.
- Follow the repository's oxfmt style and run `pnpm format`.
