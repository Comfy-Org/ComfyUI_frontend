# Level of Detail (LOD) Implementation Guide for Widgets

## What is Level of Detail (LOD)?

Level of Detail is a technique used to optimize performance by showing different amounts of detail based on how zoomed in the user is. Think of it like Google Maps - when you're zoomed out looking at the whole country, you only see major cities and highways. When you zoom in close, you see street names, building details, and restaurants.

For ComfyUI nodes, this means:
- **Zoomed out** (viewing many nodes): Show only essential controls, hide labels and descriptions
- **Zoomed in** (focusing on specific nodes): Show all details, labels, help text, and visual polish

## Why LOD Matters

Without LOD optimization:
- 1000+ nodes with full detail = browser lag and poor performance
- Text that's too small to read still gets rendered (wasted work)
- Visual effects that are invisible at distance still consume GPU

With LOD optimization:
- Smooth performance even with large node graphs
- Battery life improvement on laptops
- Better user experience across different zoom levels

## How to Implement LOD in Your Widget

### Step 1: Get the LOD Context

Every widget component gets a `zoomLevel` prop. Use this to determine how much detail to show:

```vue
<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useLOD } from '@/composables/graph/useLOD'

const props = defineProps<{
  widget: any
  zoomLevel: number
  // ... other props
}>()

// Get LOD information
const { lodScore, lodLevel } = useLOD(toRef(() => props.zoomLevel))
</script>
```

**Primary API:** Use `lodScore` (0-1) for granular control and smooth transitions  
**Convenience API:** Use `lodLevel` ('minimal'|'reduced'|'full') for simple on/off decisions

### Step 2: Choose What to Show at Different Zoom Levels

#### Understanding the LOD Score
- `lodScore` is a number from 0 to 1
- 0 = completely zoomed out (show minimal detail)
- 1 = fully zoomed in (show everything)
- 0.5 = medium zoom (show some details)

#### Understanding LOD Levels
- `'minimal'` = zoom level 0.4 or below (very zoomed out)
- `'reduced'` = zoom level 0.4 to 0.8 (medium zoom)
- `'full'` = zoom level 0.8 or above (zoomed in close)

### Step 3: Implement Your Widget's LOD Strategy

Here's a complete example of a slider widget with LOD:

```vue
<template>
  <div class="number-widget">
    <!-- The main control always shows -->
    <input 
      v-model="value"
      type="range"
      :min="widget.min"
      :max="widget.max"
      class="widget-slider"
    />
    
    <!-- Show label only when zoomed in enough to read it -->
    <label 
      v-if="showLabel"
      class="widget-label"
    >
      {{ widget.name }}
    </label>
    
    <!-- Show precise value only when fully zoomed in -->
    <span 
      v-if="showValue"
      class="widget-value"
    >
      {{ formattedValue }}
    </span>
    
    <!-- Show description only at full detail -->
    <div 
      v-if="showDescription && widget.description"
      class="widget-description"
    >
      {{ widget.description }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useLOD } from '@/composables/graph/useLOD'

const props = defineProps<{
  widget: any
  zoomLevel: number
}>()

const { lodScore, lodLevel } = useLOD(toRef(() => props.zoomLevel))

// Define when to show each element
const showLabel = computed(() => {
  // Show label when user can actually read it
  return lodScore.value > 0.4  // Roughly 12px+ text size
})

const showValue = computed(() => {
  // Show precise value only when zoomed in close
  return lodScore.value > 0.7  // User is focused on this specific widget
})

const showDescription = computed(() => {
  // Description only at full detail
  return lodLevel.value === 'full'  // Maximum zoom level
})

// You can also use LOD for styling
const widgetClasses = computed(() => {
  const classes = ['number-widget']
  
  if (lodLevel.value === 'minimal') {
    classes.push('widget--minimal')
  }
  
  return classes
})
</script>

<style scoped>
/* Apply different styles based on LOD */
.widget--minimal {
  /* Simplified appearance when zoomed out */
  .widget-slider {
    height: 4px;  /* Thinner slider */
    opacity: 0.9;
  }
}

/* Normal styling */
.widget-slider {
  height: 8px;
  transition: height 0.2s ease;
}

.widget-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.widget-value {
  font-family: monospace;
  font-size: 0.7rem;
  color: var(--text-accent);
}

.widget-description {
  font-size: 0.6rem;
  color: var(--text-muted);
  margin-top: 4px;
}
</style>
```

## Common LOD Patterns

### Pattern 1: Essential vs. Nice-to-Have
```typescript
// Always show the main functionality
const showMainControl = computed(() => true)

// Granular control with lodScore
const showLabels = computed(() => lodScore.value > 0.4)
const labelOpacity = computed(() => Math.max(0.3, lodScore.value))

// Simple control with lodLevel  
const showExtras = computed(() => lodLevel.value === 'full')
```

### Pattern 2: Smooth Opacity Transitions
```typescript
// Gradually fade elements based on zoom
const labelOpacity = computed(() => {
  // Fade in from zoom 0.3 to 0.6
  return Math.max(0, Math.min(1, (lodScore.value - 0.3) / 0.3))
})
```

### Pattern 3: Progressive Detail
```typescript
const detailLevel = computed(() => {
  if (lodScore.value < 0.3) return 'none'
  if (lodScore.value < 0.6) return 'basic'
  if (lodScore.value < 0.8) return 'standard'
  return 'full'
})
```

## LOD Guidelines by Widget Type

### Text Input Widgets
- **Always show**: The input field itself
- **Medium zoom**: Show label
- **High zoom**: Show placeholder text, validation messages
- **Full zoom**: Show character count, format hints

### Button Widgets  
- **Always show**: The button
- **Medium zoom**: Show button text
- **High zoom**: Show button description
- **Full zoom**: Show keyboard shortcuts, tooltips

### Selection Widgets (Dropdown, Radio)
- **Always show**: The current selection
- **Medium zoom**: Show option labels
- **High zoom**: Show all options when expanded
- **Full zoom**: Show option descriptions, icons

### Complex Widgets (Color Picker, File Browser)
- **Always show**: Simplified representation (color swatch, filename)
- **Medium zoom**: Show basic controls
- **High zoom**: Show full interface
- **Full zoom**: Show advanced options, previews

## Design Collaboration Guidelines

### For Designers
When designing widgets, consider creating variants for different zoom levels:

1. **Minimal Design** (far away view)
   - Essential elements only
   - Higher contrast for visibility
   - Simplified shapes and fewer details

2. **Standard Design** (normal view)
   - Balanced detail and simplicity
   - Clear labels and readable text
   - Good for most use cases

3. **Full Detail Design** (close-up view)
   - All labels, descriptions, and help text
   - Rich visual effects and polish
   - Maximum information density

### Design Handoff Checklist
- [ ] Specify which elements are essential vs. nice-to-have
- [ ] Define minimum readable sizes for text elements
- [ ] Provide simplified versions for distant viewing
- [ ] Consider color contrast at different opacity levels
- [ ] Test designs at multiple zoom levels

## Testing Your LOD Implementation

### Manual Testing
1. Create a workflow with your widget
2. Zoom out until nodes are very small
3. Verify essential functionality still works
4. Zoom in gradually and check that details appear smoothly
5. Test performance with 50+ nodes containing your widget

### Performance Considerations
- Avoid complex calculations in LOD computed properties
- Use `v-if` instead of `v-show` for elements that won't render
- Consider using `v-memo` for expensive widget content
- Test on lower-end devices

### Common Mistakes
❌ **Don't**: Hide the main widget functionality at any zoom level
❌ **Don't**: Use complex animations that trigger at every zoom change  
❌ **Don't**: Make LOD thresholds too sensitive (causes flickering)
❌ **Don't**: Forget to test with real content and edge cases

✅ **Do**: Keep essential functionality always visible
✅ **Do**: Use smooth transitions between LOD levels
✅ **Do**: Test with varying content lengths and types
✅ **Do**: Consider accessibility at all zoom levels

## Getting Help

- Check existing widgets in `src/components/graph/vueNodes/widgets/` for examples
- Ask in the ComfyUI frontend Discord for LOD implementation questions
- Test your changes with the LOD debug panel (top-right in GraphCanvas)
- Profile performance impact using browser dev tools