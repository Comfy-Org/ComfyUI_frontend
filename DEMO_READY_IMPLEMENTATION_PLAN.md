# Demo-Ready Vue Nodes Implementation Plan

## Overview
Prepare the Vue node system for demo and developer handoff by implementing essential developer ergonomics and basic robustness.

## Implementation Tasks

### ✅ 1. Widget Component Integration (30 min)
**Goal**: Vue nodes render functional widgets
**Files**: 
- `src/components/graph/vueNodes/LGraphNode.vue` (modify)
- `src/composables/graph/useWidgetRenderer.ts` (new)

**Implementation**:
```typescript
// Add widget rendering to VueGraphNode component
<div class="node-widgets" v-if="node.widgets?.length">
  <component 
    v-for="widget in node.widgets"
    :key="widget.name"
    :is="getWidgetComponent(widget.type)"
    :widget="widget"
    v-model="widget.value"
    :readonly="readonly"
  />
</div>
```

### ✅ 2. Widget Registry Integration (45 min)  
**Goal**: Connect existing Vue widgets to node system
**Files**:
- `src/composables/graph/useWidgetRenderer.ts` (new)
- Update widget registry mappings

**Implementation**:
```typescript
// Map LiteGraph widget types to Vue components
const typeMap = {
  'number': 'WidgetSlider',
  'slider': 'WidgetSlider', 
  'combo': 'WidgetSelect',
  'text': 'WidgetInputText',
  'toggle': 'WidgetToggleSwitch'
}
```

### ⏸️ 3. Feature Toggle System (20 min)
**Goal**: Production-safe feature flags
**Files**: 
- `src/composables/useFeatureFlags.ts` (new)
- `src/constants/coreSettings.ts` (modify)

### ⏸️ 4. Basic Error Boundaries 
**Status**: Out of scope - already planned in Phase 5
**Original Plan**: Comprehensive error boundaries with per-node error tracking in VUE_NODE_LIFECYCLE_DESIGN.md Phase 5

### ✅ 5. Developer Documentation (15 min)
**Goal**: Clear guide for developers
**Files**: `README_VUE_NODES.md` (new)

### ✅ 6. Widget Value Synchronization (30 min)
**Goal**: Widget changes update LiteGraph  
**Files**: `src/components/graph/vueNodes/LGraphNode.vue` (modify)

**Implementation**:
```typescript
const handleWidgetChange = (widget: any, value: any) => {
  widget.value = value
  if (widget.callback) widget.callback(value, widget, node)
  node.setDirtyCanvas(true, true)
}
```

### ✅ 7. Node Selection Sync (20 min)
**Goal**: Vue node selection syncs with LiteGraph
**Files**: `src/components/graph/vueNodes/LGraphNode.vue` (modify)

### ✅ 8. Settings Integration (20 min)
**Goal**: Proper settings for Vue nodes
**Files**: `src/constants/coreSettings.ts` (modify)

## Success Criteria

### Demo Requirements
- [ ] Vue nodes render with functional widgets
- [ ] Widget interactions work (toggle, slider, text input)
- [ ] Node selection syncs between Vue and canvas
- [ ] Feature can be safely enabled/disabled
- [ ] Clear documentation for developers

### Developer Handoff Requirements  
- [ ] Widget components ready to use
- [ ] Clear patterns and examples
- [ ] Integration points documented
- [ ] Debug tools available
- [ ] Safe defaults (feature flagged off)

## Implementation Order
1. Commit current progress (checkpoint)
2. Widget component integration + registry 
3. Feature flags and settings
4. Developer documentation
5. Widget value synchronization  
6. Node selection sync
7. Final testing and demo script

## Timeline
**Target**: 3 hours total implementation time
**Demo Ready**: After items 1-2, 5-8 complete
**Production Ready**: After all items + Phase 3-5 from main plan

## Files to Create/Modify

### New Files
- `src/composables/graph/useWidgetRenderer.ts`
- `src/composables/useFeatureFlags.ts` 
- `README_VUE_NODES.md`

### Modified Files
- `src/components/graph/vueNodes/LGraphNode.vue`
- `src/constants/coreSettings.ts`
- `src/components/graph/GraphCanvas.vue` (feature flags)

## Notes
- Error boundaries moved to Phase 5 (already planned)
- Focus on developer ergonomics over advanced features
- Maintain backward compatibility 
- All changes feature-flagged for safety