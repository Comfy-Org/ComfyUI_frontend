# Source Code Guidelines

## Service Layer

### API Calls

- Use `api.apiURL()` for backend endpoints
- Use `api.fileURL()` for static files

#### ✅ Correct Usage
```typescript
// Backend API call
const response = await api.get(api.apiURL('/prompt'))

// Static file
const template = await fetch(api.fileURL('/templates/default.json'))
```

#### ❌ Incorrect Usage
```typescript
// WRONG - Direct URL construction
const response = await fetch('/api/prompt')
const template = await fetch('/templates/default.json')
```

### Error Handling

- User-friendly and actionable messages
- Proper error propagation

### Security

- Sanitize HTML with DOMPurify
- Validate trusted sources
- Never log secrets

## State Management (Stores)

### Store Design

- Follow domain-driven design
- Clear public interfaces
- Restrict extension access

### Best Practices

- Use TypeScript for type safety
- Implement proper error handling
- Clean up subscriptions
- Avoid @ts-expect-error

## General Guidelines

- Use es-toolkit for utility functions
- Implement proper TypeScript types
- Follow Vue 3 composition API style guide
- Use vue-i18n for ALL user-facing strings in `src/locales/en/main.json`
