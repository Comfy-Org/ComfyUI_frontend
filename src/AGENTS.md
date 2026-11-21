# Source Code Guidelines

## Error Type Naming

`reportError(error, { errorType })` takes a stable slug. It lands as native RUM
`error.type` and the `error_type` Sentry tag. The legacy `error_type` RUM
context field is retained for existing queries; prefer `@error.type` for new
Datadog queries.

- Name error types from generic to specific in lowercase `snake_case`:
  `<category>_<operation>_<subject>[_detail]`. Put the category first, then
  the operation as a present participle, then the affected subject so related
  failures sort together.
- Examples: `error_loading_resource`, `error_loading_asset`,
  `error_rendering_foo`, `error_rendering_bar`, and
  `failure_initializing_workspace_auth_gate`. Here `workspace_auth_gate`
  names the `WorkspaceAuthGate` component and stays together as one subject.
- Search existing `errorType` values before adding one. Reuse the same slug
  for the same failure mode across call sites. Keep vocabulary consistent
  within a family; do not introduce synonyms such as `error_loading_asset`
  and `failure_loading_asset` for the same failure.
- Keep filenames, timestamps, IDs, URLs, and other instance-specific values
  in the error message or context, never in the type.
- Treat existing emitted types as telemetry contracts. Rename them only with
  a migration of affected queries and alerts that accounts for old and new
  releases reporting different names.
