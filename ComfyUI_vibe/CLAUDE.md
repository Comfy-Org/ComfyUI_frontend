# ComfyUI Prototypes - Development Guidelines

## Project Purpose

This is a prototype project for developing new ComfyUI frontend features. Code written here should be **portable** to the main `ComfyUI_frontend` repository.

## Quick Commands

```bash
pnpm dev          # Start dev server (port 5174)
pnpm build        # Production build
pnpm typecheck    # Type checking
pnpm lint         # Lint with Oxlint + ESLint
pnpm lint:fix     # Auto-fix lint issues
pnpm format       # Format with Prettier
```

## Critical Rules

### 1. No Hardcoding

- **NEVER** hardcode URLs, API endpoints, or server addresses
- **NEVER** hardcode user credentials, tokens, or secrets
- **NEVER** hardcode magic numbers - use named constants
- **NEVER** hardcode strings that should be configurable - use constants or config
- Use environment variables for configuration: `import.meta.env.VITE_*`

```typescript
// BAD
const apiUrl = 'http://localhost:8188'
const timeout = 30000

// GOOD
const API_URL = import.meta.env.VITE_COMFY_API_URL ?? '/api'
const TIMEOUT_MS = 30_000 as const
```

### 2. No Hallucination

- **NEVER** invent PrimeVue components - check https://primevue.org/
- **NEVER** assume ComfyUI API endpoints exist - verify in ComfyUI backend
- **NEVER** make up Vue/Pinia APIs - use official documentation
- **ALWAYS** read existing code before modifying it
- **ALWAYS** verify imports exist before using them

### 3. DRY (Don't Repeat Yourself)

- Extract repeated logic into composables (`src/composables/`)
- Extract repeated UI patterns into components (`src/components/`)
- Use shared types (`src/types/`)
- Use utility functions (`src/utils/`)

```typescript
// BAD - repeated in multiple components
const isLoading = ref(false)
const error = ref<string | null>(null)
async function fetchData() { ... }

// GOOD - extract to composable
const { isLoading, error, execute } = useAsyncState(fetchFn)
```

### 4. TypeScript Strict Mode

- **NEVER** use `any` type - find or create proper types
- **NEVER** use `as any` assertions - fix the underlying type issue
- **NEVER** use `@ts-ignore` or `@ts-expect-error` without explanation
- **ALWAYS** define return types for functions
- **ALWAYS** use strict null checks

```typescript
// BAD
function process(data: any) { ... }
const result = response as any

// GOOD
function process(data: NodeDefinition): ProcessedNode { ... }
const result = response as SystemStats
```

### 5. Vue/Component Patterns

- Use Composition API with `<script setup lang="ts">`
- Use `defineProps` with TypeScript generics
- Use `defineEmits` with typed events
- Prefer `computed` over methods for derived state
- Use `ref` for primitives, `reactive` for objects (but prefer `ref`)

```vue
<script setup lang="ts">
interface Props {
  title: string
  count?: number
}

const props = withDefaults(defineProps<Props>(), {
  count: 0
})

const emit = defineEmits<{
  update: [value: number]
  close: []
}>()
</script>
```

### 6. Pinia Store Patterns

- Use composition API style (setup stores)
- Prefix store names with `use` and suffix with `Store`
- Keep stores focused on single domain
- Export typed getters as computed refs

```typescript
export const useExampleStore = defineStore('example', () => {
  // State
  const items = ref<Item[]>([])

  // Getters (computed)
  const itemCount = computed(() => items.value.length)

  // Actions
  async function fetchItems(): Promise<void> {
    // implementation
  }

  return { items, itemCount, fetchItems }
})
```

### 7. CSS/Styling Rules

- **NEVER** use inline styles for anything but truly dynamic values
- **NEVER** use `dark:` Tailwind variants - use semantic tokens
- **ALWAYS** use semantic class names from design system
- **ALWAYS** use `cn()` utility for conditional classes (when added)

```vue
<!-- BAD -->
<div class="bg-gray-800 dark:bg-gray-100" style="padding: 10px">

<!-- GOOD -->
<div class="bg-surface-card p-2">
```

### 8. API Integration

- All API calls go through `src/services/`
- Use Zod for runtime validation of API responses
- Handle errors gracefully with user feedback
- Use typed request/response interfaces

```typescript
// Define schema
const SystemStatsSchema = z.object({
  system: z.object({
    os: z.string(),
    python_version: z.string()
  })
})

// Validate response
const stats = SystemStatsSchema.parse(response.data)
```

### 9. File Organization

```
src/
├── components/          # Reusable Vue components
│   ├── common/          # Generic components (buttons, inputs)
│   ├── layout/          # Layout components (sidebar, header)
│   └── [feature]/       # Feature-specific components
├── composables/         # Vue composition functions
├── services/            # API clients and external services
├── stores/              # Pinia stores
├── types/               # TypeScript type definitions
├── utils/               # Pure utility functions
├── views/               # Page/route components
└── assets/              # Static assets and CSS
```

### 10. Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `UserProfile.vue` |
| Composables | camelCase with `use` prefix | `useAuth.ts` |
| Stores | camelCase with `use` prefix, `Store` suffix | `useAuthStore.ts` |
| Services | camelCase with descriptive name | `comfyApi.ts` |
| Types/Interfaces | PascalCase | `UserProfile`, `AuthState` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRY_COUNT` |
| CSS classes | kebab-case | `user-profile-card` |

## ComfyUI Compatibility

### Backend API Reference

Before creating API calls, verify endpoints exist in ComfyUI:
- `/system_stats` - System information
- `/object_info` - Node definitions
- `/queue` - Queue management
- `/prompt` - Queue workflow execution
- `/history` - Execution history
- `/upload/image` - File uploads
- `/view` - View outputs

### Frontend Patterns to Follow

When porting to ComfyUI_frontend, ensure:
- Components use same prop patterns
- Stores follow same structure
- Services use same HTTP client patterns
- Types are compatible or easily adaptable

## Pre-commit Checklist

Before committing:
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build` succeeds
- [ ] No hardcoded values
- [ ] No `any` types
- [ ] Components are properly typed
- [ ] New files follow naming conventions
