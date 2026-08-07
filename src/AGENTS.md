# Source Code Guidelines

## Error Handling

- User-friendly and actionable messages
- Proper error propagation
- Expected recoverable failures in mutation, lifecycle, workflow-loading, and
  deserialization paths must preserve established result or sentinel contracts
  and log enough context for diagnosis instead of throwing. Throws remain
  appropriate for programmer errors, unrecoverable invariant violations, and
  invalid input at trust boundaries when safe recovery is unavailable.

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
