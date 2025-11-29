# Create Component

Generate a new Vue component following ComfyUI Vibe patterns.

## Usage

```
/create-component <ComponentName> <category>
```

## Categories

| Category | Path | Description |
|----------|------|-------------|
| canvas | `src/components/v2/canvas/` | Canvas-related components |
| nodes | `src/components/v2/nodes/` | Node components |
| widgets | `src/components/v2/nodes/widgets/` | Widget components |
| layout | `src/components/v2/layout/` | Layout components |
| workspace | `src/components/v2/workspace/` | Workspace components |
| dialogs | `src/components/v2/dialogs/` | Dialog/modal components |
| common | `src/components/common/` | Shared components |

## Process

### Step 1: Check for Existing Components

Before creating, search for similar components:
1. Search `src/components/v2/` for similar names
2. Search for similar functionality
3. If found, suggest using/extending existing component

### Step 2: Gather Component Info

Ask for:
1. Component name (PascalCase)
2. Category
3. Purpose (one sentence)
4. Props needed
5. Events to emit

### Step 3: Generate Component

Create the component file with:

```vue
<script setup lang="ts">
interface Props {
  // Props here
}

const props = defineProps<Props>()

const emit = defineEmits<{
  // Events here
}>()
</script>

<template>
  <div class="component-name">
    <!-- Template -->
  </div>
</template>

<style scoped>
.component-name {
  /* Styles */
}
</style>
```

### Step 4: Follow Patterns

Ensure component follows:
- [ ] `<script setup lang="ts">` syntax
- [ ] TypeScript interfaces for Props
- [ ] Typed emits
- [ ] Semantic CSS classes (no `dark:` variants)
- [ ] No hardcoded values
- [ ] Reference existing patterns

## Component Template

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  /**
   * Description of prop
   */
  propName: string
  /**
   * Optional prop with default
   */
  optionalProp?: number
}

const props = withDefaults(defineProps<Props>(), {
  optionalProp: 0
})

const emit = defineEmits<{
  /**
   * Emitted when action occurs
   */
  actionName: [value: string]
  /**
   * Emitted when component closes
   */
  close: []
}>()

// Computed properties for derived state
const derivedValue = computed(() => {
  return props.propName.toUpperCase()
})

// Local state if needed
const localState = ref(false)

// Methods for event handlers
function handleAction(): void {
  emit('actionName', derivedValue.value)
}
</script>

<template>
  <div class="component-name">
    <slot />
  </div>
</template>

<style scoped>
.component-name {
  /* Use Tailwind classes in template instead when possible */
}
</style>
```

## Reference Patterns

When creating components, reference these existing files:

| Component Type | Reference File |
|----------------|----------------|
| Store-connected | `src/components/v2/canvas/CanvasLeftSidebar.vue` |
| Widget | `src/components/v2/nodes/widgets/WidgetSlider.vue` |
| Node | `src/components/v2/nodes/NodeHeader.vue` |
| Layout | `src/components/v2/layout/WorkspaceLayout.vue` |

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Component file | PascalCase.vue | `NodeSearch.vue` |
| Props interface | Props | `interface Props` |
| Events type | Object with events | `defineEmits<{ click: [] }>()` |
| CSS class | kebab-case | `.node-search` |
| Local refs | camelCase | `const isOpen = ref(false)` |

## Output

Creates the component file at the appropriate location:

```
src/components/{version}/{category}/{ComponentName}.vue
```

## Example

**Input:**
```
/create-component NodeSearch canvas
```

**Output:**
```
Created: src/components/v2/canvas/NodeSearch.vue

Component created with:
- TypeScript props interface
- Typed emits
- Basic template structure
- Scoped styles

Next steps:
1. Add props as needed
2. Implement template
3. Add to parent component
4. Run pnpm typecheck
```
