# Vue Widget Implementation Plan

## Overview
This document outlines the implementation plan for creating simplified Vue-based widget components that will work with the new Vue node rendering system.

## Directory Structure
```
src/components/graph/vueWidgets/     # New directory alongside existing widgets
├── WidgetButton.vue
├── WidgetInputText.vue
├── WidgetSelect.vue
├── WidgetColorPicker.vue
├── WidgetMultiSelect.vue
├── WidgetSelectButton.vue
├── WidgetSlider.vue
├── WidgetTextarea.vue
├── WidgetToggleSwitch.vue
├── WidgetChart.vue
├── WidgetImage.vue
├── WidgetImageCompare.vue
├── WidgetGalleria.vue
├── WidgetFileUpload.vue
└── WidgetTreeSelect.vue
```

## Prop Filtering Utility
Create a utility file for prop filtering:
```typescript
// src/utils/widgetPropFilter.ts

// Props to exclude based on the widget interface specifications
export const STANDARD_EXCLUDED_PROPS = ['style', 'class', 'dt', 'pt', 'ptOptions', 'unstyled'] as const

export const INPUT_EXCLUDED_PROPS = [
  ...STANDARD_EXCLUDED_PROPS,
  'inputClass',
  'inputStyle'
] as const

export const PANEL_EXCLUDED_PROPS = [
  ...STANDARD_EXCLUDED_PROPS,
  'panelClass',
  'panelStyle',
  'overlayClass'
] as const

export const IMAGE_EXCLUDED_PROPS = [
  ...STANDARD_EXCLUDED_PROPS,
  'imageClass',
  'imageStyle'
] as const

export const GALLERIA_EXCLUDED_PROPS = [
  ...STANDARD_EXCLUDED_PROPS,
  'thumbnailsPosition',
  'verticalThumbnailViewPortHeight',
  'indicatorsPosition',
  'maskClass',
  'containerStyle',
  'containerClass',
  'galleriaClass'
] as const

// Utility function to filter props
export function filterWidgetProps<T extends Record<string, any>>(
  props: T | undefined,
  excludeList: readonly string[]
): Partial<T> {
  if (!props) return {}
  
  const filtered: Record<string, any> = {}
  for (const [key, value] of Object.entries(props)) {
    if (!excludeList.includes(key)) {
      filtered[key] = value
    }
  }
  return filtered as Partial<T>
}
```

## Component Template Pattern
Each widget follows this structure without style tags:
```vue
<template>
  <div class="flex flex-col gap-1">
    <label v-if="widget.name" class="text-sm opacity-80">{{ widget.name }}</label>
    <ComponentName
      v-model="value"
      v-bind="filteredProps"
      :disabled="readonly"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ComponentName from 'primevue/componentname'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'
import { filterWidgetProps, STANDARD_EXCLUDED_PROPS } from '@/utils/widgetPropFilter'

const value = defineModel<T>({ required: true })

const props = defineProps<{
  widget: SimplifiedWidget<T>
  readonly?: boolean
}>()

const filteredProps = computed(() => 
  filterWidgetProps(props.widget.options, STANDARD_EXCLUDED_PROPS)
)
</script>
```

## Complete Widget List (All 15 from the spec)

### Input Components:
1. **WidgetInputText** - Single line text input
2. **WidgetTextarea** - Multiline text input  
3. **WidgetSlider** - Numeric range slider
4. **WidgetToggleSwitch** - Boolean on/off switch

### Selection Components:
5. **WidgetSelect** - Dropdown selection
6. **WidgetMultiSelect** - Multiple item selection
7. **WidgetSelectButton** - Button group selection
8. **WidgetTreeSelect** - Hierarchical selection

### Visual Components:
9. **WidgetColorPicker** - Color picker
10. **WidgetImage** - Single image display
11. **WidgetImageCompare** - Before/after image comparison
12. **WidgetGalleria** - Image gallery/carousel
13. **WidgetChart** - Chart display (using Chart.js)

### Action Components:
14. **WidgetButton** - Button with actions
15. **WidgetFileUpload** - File upload interface

## Implementation Details

Each widget will:
- Use `defineModel` for two-way binding
- Import the appropriate PrimeVue component
- Use the prop filtering utility with the correct exclusion list
- Apply minimal Tailwind classes for basic layout
- Handle the `readonly` prop to disable interaction when needed

## Widget Type Mapping
When integrating with the node system, we'll need to map widget types to components:
```typescript
// src/components/graph/vueWidgets/widgetRegistry.ts
export enum WidgetType {
  BUTTON = 'BUTTON',
  STRING = 'STRING',
  INT = 'INT',
  FLOAT = 'FLOAT',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  COMBO = 'COMBO',
  COLOR = 'COLOR',
  MULTISELECT = 'MULTISELECT',
  SELECTBUTTON = 'SELECTBUTTON',
  SLIDER = 'SLIDER',
  TEXTAREA = 'TEXTAREA',
  TOGGLESWITCH = 'TOGGLESWITCH',
  CHART = 'CHART',
  IMAGE = 'IMAGE',
  IMAGECOMPARE = 'IMAGECOMPARE',
  GALLERIA = 'GALLERIA',
  FILEUPLOAD = 'FILEUPLOAD',
  TREESELECT = 'TREESELECT'
}

export const widgetTypeToComponent: Record<string, Component> = {
  [WidgetType.BUTTON]: WidgetButton,
  [WidgetType.STRING]: WidgetInputText,
  [WidgetType.INT]: WidgetSlider,
  [WidgetType.FLOAT]: WidgetSlider,
  [WidgetType.NUMBER]: WidgetSlider, // For compatibility
  [WidgetType.BOOLEAN]: WidgetToggleSwitch,
  [WidgetType.COMBO]: WidgetSelect,
  // ... other mappings
}
```

## SimplifiedWidget Interface
Based on the simplification plan:
```typescript
interface SimplifiedWidget<T = any> {
  name: string
  type: string
  value: T
  options?: Record<string, any>  // Contains filtered PrimeVue props
  callback?: (value: T) => void
}
```

## Key Differences from Current System
- No DOM manipulation or positioning logic
- No visibility/zoom management
- No canvas interaction
- Purely focused on value display and user input
- Relies on parent Vue components for layout and positioning