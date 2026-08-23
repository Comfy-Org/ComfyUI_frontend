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

## Package conventions

- Keep reusable logic in importable pure functions and cover it with focused
  unit tests.
- Use TypeScript with precise types; never use `any` or `as any`.
- Follow the repository's oxfmt style and run `pnpm format`.
