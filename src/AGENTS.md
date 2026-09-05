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
    errorType: 'workspace_auth_gate_initialization_failure'
  })
  ```

  `errorType` is a stable slug. It lands as the `error_type` Sentry tag and the
  `error_type` RUM context field, so one query works against either console.
  Pick a slug that names the failure, not the symptom, and reuse the existing
  one if the failure already has a name.

  [ADR-TELEMETRY-ERRORS-0030](../docs/adr/TELEMETRY-ERRORS-0030-agent-consumable-error-telemetry.md)
  proposes agent-consumable tags, assertion modes, catch classification, and
  PII rules. It is Proposed, not Accepted, until `assert()` takes an assertion
  mode and `ReportErrorOptions` takes a fingerprint, so treat it as direction
  rather than a gate.

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
