# Source Code Guidelines

## Error Handling

- User-friendly and actionable messages
- Proper error propagation
- Report failures with `reportError()` from `@/platform/telemetry/reportError` —
  never `captureException` or `datadogRum.addError` directly. Each of those
  reaches one sink, so the failure is invisible in the other console. Enforced
  by `no-restricted-imports`; only `src/platform/telemetry/**` may import the
  sinks, and it does so behind an explicit disable comment.

  ```typescript
  reportError(error, {
    errorType: 'failure_initializing_workspace_auth_gate'
  })
  ```

  `errorType` is a stable slug. It lands as native RUM `error.type` and the
  `error_type` Sentry tag. The legacy `error_type` RUM context field is retained
  for existing queries; prefer `@error.type` for new Datadog queries.

### Error Type Naming

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

## Security

- Sanitize HTML with DOMPurify
- Validate trusted sources
- Never log secrets

## State Management (Stores)

- Follow domain-driven design for organizing files/folders
- Clear public interfaces
- Restrict extension access
- Clean up subscriptions
- Only expose state/actions that are used externally; keep internal state private

## General Guidelines

- Use `es-toolkit` for utility functions
- Use TypeScript for type safety
- Avoid `@ts-expect-error` - fix the underlying issue
- Use `vue-i18n` for ALL user-facing strings (`src/locales/en/main.json`)
