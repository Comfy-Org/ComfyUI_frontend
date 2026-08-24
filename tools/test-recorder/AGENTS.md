# Test Recorder Guidance

## Dual-audience contract

Every `comfy-test` capability MUST be reachable both interactively through
Clack prompts for humans and non-interactively through subcommands, flags, or
environment variables for automation. When adding or changing a feature,
implement and document both paths. A prompt-only or flag-only feature is
incomplete.

Every setup prompt in `record` MUST have a corresponding prefill flag. QA test
plans must be able to embed one copy-pastable `pnpm comfy-test record ...`
command that skips all setup questions when every answer is valid.

## Third audience: an agent supervising a human

There is a third user of this tool beyond "human at a terminal" and
"agent automating": **an agent helping a non-technical human walk through
the human path**. That agent shapes how the human experiences the tool, so
it must be steered too. `comfy-test guide` prints the operating manual for
that role (`src/commands/guide.ts`): hand over the three setup commands
immediately, use plain words ("proof step", never "assertion"), never
mention lint/CI/branches, reassure constantly that messy contributions are
genuinely valuable, and never close a PR because the human is worried.

When changing user-facing prompts or flows, check whether `guide` needs a
matching update — its description of what the human will see must stay
true.

## Interface parity

| Capability             | Interactive `record` path                    | Non-interactive path                                                                         |
| ---------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Target distribution    | Distribution selector with live versions     | `record --distribution <id>`; `check --distribution <id>` or `COMFY_TEST_DISTRIBUTION`       |
| Custom backend         | “Custom backend…” selection and URL prompt   | `record --backend <url>`; `check --backend <url>` or `COMFY_TEST_BACKEND`                    |
| Workflow search        | Searchable workflow autocomplete             | `list --filter <keyword>`                                                                    |
| Add workflow from file | “(add from file…)” workflow option           | `add-workflow <file> [--name <n>]`                                                           |
| Test tags              | Tag multiselect with hints                   | `tags` lists the registry with descriptions; `plan --tags` and `transform --tags` apply tags |
| Record setup answers   | Guided prompts                               | `record --workflow --tags --feature-flags --use-case --description --name`                   |
| Feature flags          | Feature-flag selector and custom flag prompt | `record`, `plan`, or `transform --feature-flags <specs>`                                     |
| PR checkout            | Safe switch confirmation                     | `record --pr <number>`                                                                       |
| Secret scrubbing       | Automatic during `record`, with a loud alert | Automatic in `transform <file>`; findings print as 🔒 lines in the summary                   |
| Supervisor guidance    | Woven into `record` prompts and warnings     | `guide` prints the full operating manual for an agent helping a human                        |

## Distribution-aware recording template

The `comfyPage` fixture boots through OSS-only devtools APIs
(`/api/devtools/set_settings` etc.) that cloud backends don't serve, so the
recording template branches on the selected distribution
(`recordingTarget` in `src/recorder/template.ts`):

- **local** — full `comfyPage` template: workflow pre-load, `test.use({
initialFeatureFlags })`.
- **cloud / cloud-staging / cloud-prod / custom** — bare-page template:
  `page.goto(PLAYWRIGHT_TEST_URL)` and the recorder enabled immediately —
  no boot gate, so a sign-in screen can't stall the recorder (sign in
  manually, then record). Feature flags use repeatable
  `?ff=<key>:<JSON value>` URL parameters. The app captures these in
  `Comfy.FeatureFlagOverride` session storage, so they apply only to the
  recording tab and disappear when it closes.
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
