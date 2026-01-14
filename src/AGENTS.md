# Source Code Guidelines

## API Calls

- Use `api.apiURL()` for backend endpoints
- Use `api.fileURL()` for static files

```typescript
// ✅ Correct
const response = await api.get(api.apiURL('/prompt'))
const template = await fetch(api.fileURL('/templates/default.json'))

// ❌ Wrong - direct URL construction
const response = await fetch('/api/prompt')
```

## Error Handling

- User-friendly and actionable messages
- Proper error propagation

## Security

- Sanitize HTML with DOMPurify
- Validate trusted sources
- Never log secrets

## State Management (Stores)

- Follow domain-driven design
- Clear public interfaces
- Restrict extension access
- Clean up subscriptions
