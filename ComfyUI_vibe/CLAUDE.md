# ComfyUI Prototypes - Development Guidelines

<!-- Rules Version: 1.0 | Last Updated: 2025-11-28 -->
<!-- Synced with: .cursorrules, .vscode/comfyui-vibe.code-snippets -->

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

### 3.1 Component Size Limits (HARD RULE)

- **NEVER** let a `.vue` file exceed **300 lines** of code
- **NEVER** let `<template>` section exceed **150 lines**
- **NEVER** let `<script>` section exceed **150 lines**
- If a component grows beyond these limits, **STOP and refactor immediately**

**When limits are exceeded:**
1. Extract repeated UI patterns into child components
2. Extract logic into composables
3. Split large components into smaller, focused ones

```
src/components/
├── common/              # Reusable UI primitives
│   ├── TreeCategory.vue     # Collapsible category header
│   ├── TreeItem.vue         # Tree list item
│   ├── GridCard.vue         # Grid card component
│   ├── ViewModeToggle.vue   # List/grid toggle
│   ├── FilterDropdown.vue   # Filter dropdown
│   └── SearchInput.vue      # Search input with icon
```

```vue
<!-- BAD: 800+ line sidebar component -->
<template>
  <!-- Inline tree items, grid cards, dropdowns... -->
</template>

<!-- GOOD: Composed from small components -->
<template>
  <SidebarPanel>
    <SearchInput v-model="query" />
    <ViewModeToggle v-model="viewMode" />
    <TreeCategory v-for="cat in categories" :key="cat.id">
      <TreeItem v-for="item in cat.items" :key="item.id" />
    </TreeCategory>
  </SidebarPanel>
</template>
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

This project supports **two parallel interface versions**:
- **Interface 1.0 (v1)**: Legacy UI/UX - compatible with current ComfyUI
- **Interface 2.0 (v2)**: Experimental UI/UX - new design patterns

```
src/
├── components/
│   ├── common/          # Shared components across both versions
│   ├── v1/              # Interface 1.0 components
│   │   ├── canvas/      # Canvas components
│   │   ├── layout/      # Layout components
│   │   └── [feature]/   # Feature-specific components
│   └── v2/              # Interface 2.0 components (experimental)
│       ├── canvas/      # Canvas components
│       ├── dialogs/     # Dialog components
│       ├── layout/      # Layout components
│       ├── nodes/       # Node components
│       │   └── widgets/ # Widget components
│       └── workspace/   # Workspace components
├── composables/
│   ├── common/          # Shared composables
│   ├── v1/              # V1-specific composables
│   └── v2/              # V2-specific composables
├── services/            # API clients (shared)
├── stores/              # Pinia stores (shared)
├── types/               # TypeScript types (shared)
├── utils/               # Utility functions (shared)
├── data/                # Static data files
├── views/
│   ├── v1/              # Interface 1.0 views
│   └── v2/              # Interface 2.0 views
│       ├── workspace/   # Workspace sub-views
│       └── project/     # Project sub-views
└── assets/
    └── css/             # Stylesheets
```

**Import Patterns:**
```typescript
// V2 components
import CanvasView from '@/components/v2/canvas/CanvasView.vue'

// V1 components
import CanvasView from '@/components/v1/canvas/CanvasView.vue'

// Common/shared components
import Button from '@/components/common/Button.vue'

// Shared services, stores, types (version-agnostic)
import { useComfyStore } from '@/stores/comfyStore'
import { comfyApi } from '@/services/comfyApi'
import type { NodeDefinition } from '@/types/node'
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

## Common Pitfalls

- NEVER use `any` type - use proper TypeScript types
- NEVER use `as any` type assertions - fix the underlying type issue
- NEVER use `--no-verify` flag when committing
- NEVER delete or disable tests to make them pass
- NEVER circumvent quality checks
- NEVER use `dark:` Tailwind variants - use semantic tokens like `bg-surface-card`
- NEVER use deprecated PrimeVue components (see PrimeVue section below)

### PrimeVue Component Replacements

DO NOT use deprecated components. Use these instead:
- Dropdown → Select (`import from 'primevue/select'`)
- OverlayPanel → Popover (`import from 'primevue/popover'`)
- Calendar → DatePicker (`import from 'primevue/datepicker'`)
- InputSwitch → ToggleSwitch (`import from 'primevue/toggleswitch'`)
- Sidebar → Drawer (`import from 'primevue/drawer'`)

## Pre-commit Checklist

Before committing:
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build` succeeds
- [ ] No hardcoded values
- [ ] No `any` types
- [ ] Components are properly typed
- [ ] New files follow naming conventions

## Agent Workflow

This project uses specialized Claude agents for different phases of development:

1. **PRD Agent** (`/create-prd`) - Creates Product Requirements Documents
2. **UX Agent** (`/ux-review`) - Reviews and designs user experience flows
3. **UI Agent** (`/ui-design`) - Creates UI component specifications
4. **Product Agent** (`/product-review`) - Reviews from product perspective

See `.claude/commands/` for all available commands.
