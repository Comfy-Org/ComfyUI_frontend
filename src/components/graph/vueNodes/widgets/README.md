# Vue Node Widgets

This directory contains Vue components for rendering node widgets in the ComfyUI frontend.

## Getting Started

### Creating a New Widget

1. Create a new `.vue` file in this directory
2. Follow the widget component patterns from existing widgets
3. **Implement Level of Detail (LOD)** - see [LOD Implementation Guide](./LOD_IMPLEMENTATION_GUIDE.md)
4. Register your widget in the widget registry
5. Add appropriate tests

### Widget Component Structure

```vue
<template>
  <!-- Your widget UI -->
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useLOD } from '@/composables/graph/useLOD'

const props = defineProps<{
  widget: any
  zoomLevel: number
  readonly?: boolean
}>()

// Implement LOD for performance
const { lodScore, lodLevel } = useLOD(toRef(() => props.zoomLevel))

// Your widget logic
</script>

<style scoped>
/* Widget-specific styles */
</style>
```

## Level of Detail (LOD) Implementation

**All widgets must implement LOD for performance with large graphs.**

See the comprehensive [LOD Implementation Guide](./LOD_IMPLEMENTATION_GUIDE.md) for:
- What LOD is and why it matters
- Step-by-step implementation examples
- Common patterns and best practices
- Design collaboration guidelines
- Testing recommendations

## Widget Types

### Input Widgets
- Text inputs, number inputs, sliders
- Should always show the input control
- Show labels and validation at appropriate zoom levels

### Selection Widgets  
- Dropdowns, radio buttons, checkboxes
- Show current selection always
- Progressive disclosure of options based on zoom

### Display Widgets
- Read-only text, images, status indicators
- Consider whether content is readable at current zoom
- Hide decorative elements when zoomed out

### Complex Widgets
- File browsers, color pickers, rich editors
- Provide simplified representations when zoomed out
- Full functionality only when zoomed in close

## Performance Guidelines

1. **Use LOD** - Essential for good performance
2. **Optimize renders** - Use `v-memo` for expensive content
3. **Minimize DOM** - Use `v-if` instead of `v-show` for LOD elements
4. **Test at scale** - Verify performance with 100+ nodes

## Testing Your Widget

1. **Unit tests** - Test widget logic and LOD behavior
2. **Component tests** - Test Vue component rendering
3. **Visual tests** - Verify appearance at different zoom levels
4. **Performance tests** - Test with many instances

## Common Patterns

### Widget Value Synchronization
```typescript
// Keep widget value in sync with LiteGraph
const value = computed({
  get: () => props.widget.value,
  set: (newValue) => {
    props.widget.value = newValue
    // Trigger LiteGraph update
    props.widget.callback?.(newValue)
  }
})
```

### Conditional Rendering Based on Widget Options
```typescript
const showAdvancedOptions = computed(() => 
  props.widget.options?.advanced && lodLevel.value === 'full'
)
```

### Accessibility
```vue
<template>
  <div 
    :aria-label="widget.name"
    :aria-describedby="showDescription ? 'desc-' + widget.id : undefined"
  >
    <!-- Widget content -->
    <div 
      v-if="showDescription"
      :id="'desc-' + widget.id"
      class="sr-only"
    >
      {{ widget.description }}
    </div>
  </div>
</template>
```

## Resources

- [LOD Implementation Guide](./LOD_IMPLEMENTATION_GUIDE.md) - Complete guide to implementing Level of Detail
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
- [PrimeVue Components](https://primevue.org/) - Available UI components
- ComfyUI Widget API documentation (see main docs)

## Getting Help

- Check existing widgets for implementation examples
- Ask in the ComfyUI frontend Discord
- Create an issue for complex widget requirements
- Review the LOD debug panel for performance insights