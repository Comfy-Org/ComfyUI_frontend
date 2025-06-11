# Step-by-Step Guide: Converting Widgets to Vue Components in ComfyUI

## Overview
This guide explains how to convert existing DOM widgets or create new widgets using Vue components in ComfyUI. The Vue widget system provides better reactivity, type safety, and maintainability compared to traditional DOM manipulation.

## Prerequisites
- Understanding of Vue 3 Composition API
- Basic knowledge of TypeScript
- Familiarity with ComfyUI widget system

## Step 1: Create the Vue Component

Create a new Vue component in `src/components/graph/widgets/`:

```vue
<!-- src/components/graph/widgets/YourWidget.vue -->
<template>
  <div class="your-widget-container">
    <!-- Your widget UI here -->
    <input 
      v-model="modelValue" 
      type="text"
      class="w-full px-2 py-1 rounded"
    />
  </div>
</template>

<script setup lang="ts">
import { defineModel, defineProps } from 'vue'
import type { ComponentWidget } from '@/types'

// Define two-way binding for the widget value
const modelValue = defineModel<string>({ required: true })

// Receive widget configuration
const { widget } = defineProps<{
  widget: ComponentWidget<string>
}>()

// Access widget properties
const inputSpec = widget.inputSpec
const options = inputSpec.options || {}

// Add any logic necessary here to make a functional, feature-rich widget.
// You can use the vueuse library for helper functions.
// You can take liberty in things to add, as this is just a prototype.
</script>

<style scoped>
/* Use Tailwind classes in template, custom CSS here if needed */
</style>
```

## Step 2: Create the Widget Composables (Dual Pattern)

The Vue widget system uses a **dual composable pattern** for separation of concerns:

### 2a. Create the Widget Constructor Composable

Create the core widget constructor in `src/composables/widgets/`:

```typescript
// src/composables/widgets/useYourWidget.ts
import { ref } from 'vue'
import type { LGraphNode } from '@comfyorg/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import type { ComfyWidgetConstructorV2 } from '@/scripts/widgets'
import YourWidget from '@/components/graph/widgets/YourWidget.vue'

const PADDING = 8

export const useYourWidget = (options: { defaultValue?: string } = {}) => {
  const widgetConstructor: ComfyWidgetConstructorV2 = (
    node: LGraphNode,
    inputSpec: InputSpec
  ) => {
    // Initialize widget value
    const widgetValue = ref<string>(options.defaultValue ?? '')
    
    // Create the widget instance
    const widget = new ComponentWidgetImpl<string>({
      node,
      name: inputSpec.name,
      component: YourWidget,
      inputSpec,
      options: {
        // Required: getter for widget value
        getValue: () => widgetValue.value,
        
        // Required: setter for widget value
        setValue: (value: string) => {
          widgetValue.value = value
        },
        
        // Optional: minimum height for the widget
        getMinHeight: () => options.minHeight ?? 40 + PADDING,
        
        // Optional: whether to serialize this widget's value
        serialize: true,
        
        // Optional: custom serialization
        serializeValue: (value: string) => {
          return { yourWidget: value }
        }
      }
    })
    
    // Register the widget with the node
    addWidget(node, widget)
    
    return widget
  }
  
  return widgetConstructor
}
```

### 2b. Create the Node-Level Logic Composable (When Needed)

**Only create this if your widget needs dynamic management** (showing/hiding widgets based on events, execution state, etc.). Most standard widgets only need the widget constructor composable.

For widgets that need node-level operations (like showing/hiding widgets dynamically), create a separate composable in `src/composables/node/`:

```typescript
// src/composables/node/useNodeYourWidget.ts
import type { LGraphNode } from '@comfyorg/litegraph'
import { useYourWidget } from '@/composables/widgets/useYourWidget'

const YOUR_WIDGET_NAME = '$$node-your-widget'

/**
 * Composable for handling node-level operations for YourWidget
 */
export function useNodeYourWidget() {
  const yourWidget = useYourWidget()

  const findYourWidget = (node: LGraphNode) =>
    node.widgets?.find((w) => w.name === YOUR_WIDGET_NAME)

  const addYourWidget = (node: LGraphNode) =>
    yourWidget(node, {
      name: YOUR_WIDGET_NAME,
      type: 'yourWidgetType'
    })

  /**
   * Shows your widget for a node
   * @param node The graph node to show the widget for
   * @param value The value to set
   */
  function showYourWidget(node: LGraphNode, value: string) {
    const widget = findYourWidget(node) ?? addYourWidget(node)
    widget.value = value
    node.setDirtyCanvas?.(true)
  }

  /**
   * Removes your widget from a node
   * @param node The graph node to remove the widget from
   */
  function removeYourWidget(node: LGraphNode) {
    if (!node.widgets) return

    const widgetIdx = node.widgets.findIndex(
      (w) => w.name === YOUR_WIDGET_NAME
    )

    if (widgetIdx > -1) {
      node.widgets[widgetIdx].onRemove?.()
      node.widgets.splice(widgetIdx, 1)
    }
  }

  return {
    showYourWidget,
    removeYourWidget
  }
}
```

## Step 3: Register the Widget

Add your widget to the global widget registry in `src/scripts/widgets.ts`:

```typescript
// src/scripts/widgets.ts
import { useYourWidget } from '@/composables/widgets/useYourWidget'
import { transformWidgetConstructorV2ToV1 } from '@/scripts/utils'

export const ComfyWidgets: Record<string, ComfyWidgetConstructor> = {
  // ... existing widgets ...
  YOUR_WIDGET: transformWidgetConstructorV2ToV1(useYourWidget()),
}
```

## Step 4: Handle Widget-Specific Logic

For widgets that need special handling (e.g., listening to execution events):

```typescript
// In your composable or a separate composable
import { useExecutionStore } from '@/stores/executionStore'
import { watchEffect, onUnmounted } from 'vue'

export const useYourWidgetLogic = (nodeId: string) => {
  const executionStore = useExecutionStore()
  
  // Watch for execution state changes
  const stopWatcher = watchEffect(() => {
    if (executionStore.isNodeExecuting(nodeId)) {
      // Handle execution start
    }
  })
  
  // Cleanup
  onUnmounted(() => {
    stopWatcher()
  })
}
```

## Step 5: Handle Complex Widget Types

For widgets with complex data types or special requirements:

```typescript
// Multi-value widget example
const widget = new ComponentWidgetImpl<string[]>({
  node,
  name: inputSpec.name,
  component: MultiSelectWidget,
  inputSpec,
  options: {
    getValue: () => widgetValue.value,
    setValue: (value: string[]) => {
      widgetValue.value = Array.isArray(value) ? value : []
    },
    getMinHeight: () => 40 + PADDING,
    
    // Custom validation
    isValid: (value: string[]) => {
      return Array.isArray(value) && value.length > 0
    }
  }
})
```

## Step 6: Add Widget Props (Optional)

Pass additional props to your Vue component:

```typescript
const widget = new ComponentWidgetImpl<string, { placeholder: string }>({
  node,
  name: inputSpec.name,
  component: YourWidget,
  inputSpec,
  props: {
    placeholder: 'Enter value...'
  },
  options: {
    // ... options
  }
})
```

## Step 7: Handle Widget Lifecycle

For widgets that need cleanup or special lifecycle handling:

```typescript
// In your widget component
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  // Initialize resources
})

onUnmounted(() => {
  // Cleanup resources
})
</script>
```

## Step 8: Test Your Widget

1. Create a test node that uses your widget:
```python
class TestYourWidget:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "value": ("YOUR_WIDGET", {"default": "test"})
            }
        }
```

2. Write unit tests for your composable:
```typescript
// tests-ui/composables/useYourWidget.test.ts
import { describe, it, expect } from 'vitest'
import { useYourWidget } from '@/composables/widgets/useYourWidget'

describe('useYourWidget', () => {
  it('creates widget with correct default value', () => {
    const constructor = useYourWidget({ defaultValue: 'test' })
    // ... test implementation
  })
})
```

## Common Patterns and Best Practices

### 1. Use PrimeVue Components (REQUIRED)

**Always use PrimeVue components** for UI elements to maintain consistency across the application. ComfyUI includes PrimeVue 4.2.5 with 147 available components.

**Reference Documentation**: 
- See `primevue-components.md` in the project root directory for a complete list of all available PrimeVue components with descriptions and documentation links
- Alternative location: `vue-widget-conversion/primevue-components.md` (if working in a conversion branch)
- This reference includes all 147 components organized by category (Form, Button, Data, Panel, etc.) with enhanced descriptions

**Important**: When deciding how to create a widget, always consult the PrimeVue components reference first to find the most appropriate component for your use case.

Common widget components include:

```vue
<template>
  <!-- Text input -->
  <InputText v-model="modelValue" class="w-full" />
  
  <!-- Number input -->
  <InputNumber v-model="modelValue" class="w-full" />
  
  <!-- Dropdown selection -->
  <Dropdown v-model="modelValue" :options="options" class="w-full" />
  
  <!-- Multi-selection -->
  <MultiSelect v-model="modelValue" :options="options" class="w-full" />
  
  <!-- Toggle switch -->
  <ToggleSwitch v-model="modelValue" />
  
  <!-- Slider -->
  <Slider v-model="modelValue" class="w-full" />
  
  <!-- Text area -->
  <Textarea v-model="modelValue" class="w-full" />
  
  <!-- File upload -->
  <FileUpload mode="basic" />
  
  <!-- Color picker -->
  <ColorPicker v-model="modelValue" />
  
  <!-- Rating -->
  <Rating v-model="modelValue" />
</template>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Dropdown from 'primevue/dropdown'
import MultiSelect from 'primevue/multiselect'
import ToggleSwitch from 'primevue/toggleswitch'
import Slider from 'primevue/slider'
import Textarea from 'primevue/textarea'
import FileUpload from 'primevue/fileupload'
import ColorPicker from 'primevue/colorpicker'
import Rating from 'primevue/rating'
</script>
```

**Important**: Always import PrimeVue components individually as shown above, not from the main primevue package.

### 2. Handle Type Conversions
Ensure proper type handling:
```typescript
setValue: (value: string | number) => {
  widgetValue.value = String(value)
}
```

### 3. Responsive Design
Use Tailwind classes for responsive widgets:
```vue
<div class="w-full min-h-[40px] max-h-[200px] overflow-y-auto">
```

### 4. Error Handling
Add validation and error states:
```vue
<template>
  <div :class="{ 'border-red-500': hasError }">
    <!-- widget content -->
  </div>
</template>
```

### 5. Performance
Use `v-show` instead of `v-if` for frequently toggled content:
```vue
<div v-show="isExpanded">...</div>
```

## File References

- **Widget components**: `src/components/graph/widgets/`
- **Widget composables**: `src/composables/widgets/`
- **Widget registration**: `src/scripts/widgets.ts`
- **DOM widget implementation**: `src/scripts/domWidget.ts`
- **Widget store**: `src/stores/domWidgetStore.ts`
- **Widget container**: `src/components/graph/DomWidgets.vue`
- **Widget wrapper**: `src/components/graph/widgets/DomWidget.vue`

## Real Examples from PRs

### Example 1: Text Progress Widget (PR #3824)

**Component** (`src/components/graph/widgets/TextPreviewWidget.vue`):
```vue
<template>
  <div class="relative w-full text-xs min-h-[28px] max-h-[200px] rounded-lg px-4 py-2 overflow-y-auto">
    <div class="flex items-center gap-2">
      <div class="flex-1 break-all flex items-center gap-2">
        <span v-html="formattedText"></span>
        <Skeleton v-if="isParentNodeExecuting" class="!flex-1 !h-4" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNodeProgressText } from '@/composables/node/useNodeProgressText'
import { formatMarkdownValue } from '@/utils/formatUtil'
import Skeleton from 'primevue/skeleton'

const modelValue = defineModel<string>({ required: true })
const { widget } = defineProps<{ widget?: object }>()

const { isParentNodeExecuting } = useNodeProgressText(widget?.node)
const formattedText = computed(() => formatMarkdownValue(modelValue.value || ''))
</script>
```

### Example 2: Multi-Select Widget (PR #2987)

**Component** (`src/components/graph/widgets/MultiSelectWidget.vue`):
```vue
<template>
  <div>
    <MultiSelect
      v-model="selectedItems"
      :options="options"
      filter
      :placeholder="placeholder"
      :max-selected-labels="3"
      :display="display"
      class="w-full"
    />
  </div>
</template>

<script setup lang="ts">
import MultiSelect from 'primevue/multiselect'
import type { ComponentWidget } from '@/types'
import type { ComboInputSpec } from '@/types/apiTypes'

const selectedItems = defineModel<string[]>({ required: true })
const { widget } = defineProps<{ widget: ComponentWidget<string[]> }>()

const inputSpec = widget.inputSpec as ComboInputSpec
const options = inputSpec.options ?? []
const placeholder = inputSpec.multi_select?.placeholder ?? 'Select items'
const display = inputSpec.multi_select?.chip ? 'chip' : 'comma'
</script>
```

## Migration Checklist

When converting an existing widget:

- [ ] Identify the widget type and its current implementation
- [ ] Create Vue component with proper v-model binding using PrimeVue components
- [ ] Create widget constructor composable in `src/composables/widgets/`
- [ ] Create node-level composable in `src/composables/node/` (only if widget needs dynamic management)
- [ ] Implement getValue/setValue logic with Vue reactivity
- [ ] Handle any special widget behavior (events, validation, execution state)
- [ ] Register widget in ComfyWidgets registry
- [ ] Test with actual nodes that use the widget type
- [ ] Add unit tests for both composables
- [ ] Update documentation if needed

## Key Implementation Patterns

### 1. Vue Component Definition
- Use Composition API with `<script setup>`
- Use `defineModel` for two-way binding
- Accept `widget` prop to access configuration
- Use Tailwind CSS for styling

### 2. Dual Composable Pattern
- **Widget Composable** (`src/composables/widgets/`): Always required - creates widget constructor, handles component instantiation and value management
- **Node Composable** (`src/composables/node/`): Only needed for dynamic widget management (showing/hiding based on events/state)
- Return `ComfyWidgetConstructorV2` from widget composable
- Use `ComponentWidgetImpl` class as bridge between Vue and LiteGraph
- Handle value initialization and updates with Vue reactivity

### 3. Widget Registration
- Use `ComponentWidgetImpl` as bridge between Vue and LiteGraph
- Register in `domWidgetStore` for state management
- Add to `ComfyWidgets` registry

### 4. Integration Points
- **DomWidgets.vue**: Main container for all widgets
- **DomWidget.vue**: Wrapper handling positioning and rendering
- **domWidgetStore**: Centralized widget state management
- **executionStore**: For widgets reacting to execution state

This guide provides a complete pathway for creating Vue-based widgets in ComfyUI, following the patterns established in PRs #3824 and #2987.

The system uses:
- Cloud Scheduler → HTTP POST → Cloud Run API endpoints
- Pub/Sub is only for event-driven tasks (file uploads, deletions)
- Direct HTTP approach for scheduled tasks with OIDC authentication

Existing Scheduled Tasks

1. Node Reindexing - Daily at midnight
2. Security Scanning - Hourly
3. Comfy Node Pack Backfill - Every 6 hours

Standard Approach for GitHub Stars Update

Following the established pattern, you would:

1. Add API endpoint to openapi.yml
2. Implement handler in server/implementation/registry.go
3. Add Cloud Scheduler job in infrastructure/modules/compute/cloud_scheduler.tf
4. Update authentication rules

The scheduler would be configured like:
schedule = "0 2 */2 * *"  # Every 2 days at 2 AM PST
uri = "${var.registry_backend_url}/packs/update-github-stars?max_packs=100"

This follows the exact same HTTP-based pattern as the existing reindex-nodes, security-scan, and
comfy-node-pack-backfill jobs. The infrastructure is designed around direct HTTP calls rather than
pub/sub orchestration for scheduled tasks.
