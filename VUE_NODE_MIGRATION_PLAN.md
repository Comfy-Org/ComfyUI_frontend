# Vue Node Migration Plan

## Executive Summary

This plan outlines a phased migration from LiteGraph canvas rendering to Vue-based DOM rendering for ComfyUI nodes. Vue-based nodes allows access to component libraries (PrimeVue) and CSS frameworks, which increases iteration speed significantly. The migration preserves LiteGraph as the source of truth for graph logic while leveraging Vue components for rich, accessible node interfaces. Increased development speed will facilitate next gen UI/UX changes: .

## Goals and Objectives

### Primary Goals

- Enable rapid UI iteration with Vue's component model, PrimeVue, and CSS frameworks
- Maintain performance for workflows with 100+ nodes
- Preserve extension compatibility (90%+ without changes)
- Improve developer experience

### Success Metrics

- New components implementable in <1 hour (vs. current DOM manipulation)
- Performance regression <25% for 100-node workflows
- 90% of existing extensions work unmodified
- 3x faster UI development iteration
- Memory usage within 1.5x of canvas-only approach

### Non-Goals

- Complete canvas replacement (connections remain canvas-rendered)
- Mobile/touch optimization (separate initiative)
- Workflow format changes (must remain compatible)
- Extension API redesign (compatibility layer only)

### Definition of Done

- All core node types render via Vue components
- Canvas handles only connections and viewport
- Performance benchmarks meet targets
- Extension compatibility layer tested with top 20 extensions
- Migration guide published for extension developers whose extensions are broken by the migration
- Feature flag allows instant rollback

## Architecture Overview

### Current State

LiteGraph with mixed rendering approaches:

- **Canvas**: node bodies, connections, grid, selection
- **Widgets**: Three types coexist:
  - Canvas widgets (drawn in 2D context)
  - DOM widgets (manually positioned HTML elements)
  - Vue widgets (components positioned via DOM)
- **Events**: Canvas handles most interactions, delegates to widgets
- **State**: Stored in LiteGraph node/graph objects

### Target State

Hybrid rendering with clear separation:

- **Canvas**: connections, grid, viewport pan/zoom, selection rectangles
- **DOM (Vue)**: all node contents and widgets unified as Vue components
- **Transform Pane**: single Vue-managed container synchronized with canvas transforms
- **State**: LiteGraph remains source of truth, Vue observes changes

### Hybrid Approach

During migration, both systems coexist:

- Feature flag controls Vue rendering per node type
- Canvas nodes and Vue nodes can connect normally
- Shared event system handles both rendering modes
- Progressive migration allows testing at each phase

## Technical Design

### Component Architecture

```
GraphCanvas.vue
└── TransformPane.vue (synchronized with canvas transforms)
    └── LGraphNode.vue (v-for visible nodes)
        ├── NodeHeader.vue (title, controls)
        ├── NodeSlots.vue (input/output connection points)
        │   ├── InputSlot.vue (connection target)
        │   └── OutputSlot.vue (connection source)
        ├── NodeWidgets.vue (parameter controls)
        │   └── [Widget components rendered here]
        │       ├── NumberWidget.vue
        │       ├── StringWidget.vue
        │       ├── ComboWidget.vue
        │       └── [etc...]
        └── NodeContent.vue (custom content area)
```

Slots = connection points for node edges
Widgets = UI controls for node parameters

### State Management

- **One-way data flow**: LiteGraph → Vue components (props down, events up)
  - Widget values flow from LiteGraph to Vue as props
  - User interactions emit events that update LiteGraph
  - Updated values flow back to Vue, completing the cycle
- **LiteGraph as source of truth**: All node/graph state remains in LiteGraph
- **Vue as view layer**: Components observe and reflect LiteGraph state

### Event System

- **Canvas events**: Pan, zoom, connection dragging, box selection
- **DOM events**: Node interactions, widget inputs, context menus
- **Transform sync**: No coordinate mapping needed - transforms handle positioning
- **(Future) Event delegation**: Single listener on TransformPane for efficiency
- **(Future) Touch handling**: Unified pointer events for mouse/touch consistency

### Positioning Strategy: CSS Transforms

For positioning nodes in the DOM, we'll use CSS transforms rather than absolute positioning with top/left. This decision is based on significant performance benefits validated by industry leaders (React Flow, Excalidraw, tldraw, Figma).

#### Core Implementation

```vue
<!-- TransformPane synchronized with canvas -->
<div class="transform-pane" :style="{ transform: `scale(${zoom}) translate(${panX}px, ${panY}px)` }">
  <!-- Individual nodes use simple translate -->
  <div v-for="node in visibleNodes" 
       :style="{ transform: `translate(${node.x}px, ${node.y}px)` }">
</div>
```

#### Key Optimizations

- **CSS Containment**: `contain: layout style paint` isolates node rendering
- **GPU Acceleration**: `will-change: transform` during interactions only
- **Batched Updates**: CSS custom properties for efficient updates

#### Handling PrimeVue Overlays

Portal strategy for components with fixed positioning:

```vue
<Teleport to="body" v-if="showOverlay">
  <Popover :style="{ position: 'fixed', left: `${coords.x}px`, top: `${coords.y}px` }">
</Teleport>
```

#### Alternative Approaches

| Approach | Performance | Complexity | Use Case |
|----------|------------|------------|-----------|
| **CSS Transforms** | Excellent (GPU) | Medium | ✅ Our choice |
| **Absolute Position** | Poor (reflow) | Low | Small node counts |
| **Canvas Rendering** | Best | High | Not compatible with Vue |
| **SVG** | Good | Medium | Better for connections |

## Migration Strategy

### Phase 1: Widget Migration

For each widget:

- Create a new Vue component for the widget, using the API defined here: https://www.notion.so/drip-art/Widget-Componet-APIs-2126d73d365080b0bf30f241c09dd756
- If the widget existed before, alias the constructor to the new component (q: why not just replace entirely? any reason to keep the old constructor?)
- If the widget is new, create a new constructor for the widget and add to widgets.ts
- Implement the existing widget interface in the new component (i.e., create Vue-compatible mappings of the LG widget's props and events)
- Avoid components that use things like fixed positioning, teleport, `fill-available`, in the widget component (e.g., PrimeVue's Popover, Tooltip, Select) as they will require a portal strategy to work with transforms

### Phase 2: Node Migration

- Create a new Vue component for the node
- [maybe later] Create conditional render for LOD, distance cull, and viewport cull
- Implement the existing node interface in the new node component (i.e., create Vue-compatible mappings of the LG node's props and events)

### Phase 3: Transform Pane

- Create the transform pane
- Synchronize the transform pane with the canvas transforms
- Use `transform-origin` to position the transform pane in accordance with the canvas
- Use `will-change: transform` and verify with DevTools that nodes are on a single layer and not being promoted
  - NOTE: in future, we need to actively prevent layer promotion (see promotion conditions: https://source.chromium.org/chromium/chromium/src/+/refs/heads/main:third_party/blink/renderer/platform/graphics/compositing_reasons.h;l=18;drc=4e8e81f6eeb6969973f3ec97132d80339b92d227)

### Phase 4: Interaction System

- Map all existing events from previous interface
  - Map all lifecycle hooks
- Add event delegation for transform pane events
- Restrict touch events to the transform pane
- For any event (except those affecting the entire transform pane) that affects compositing (e.g., moving nodes, resizing nodes), batch in RAF

### Phase 5: Portals

- Create a portal component that can be used to render components that use fixed positioning, teleport, `fill-available`, etc.

### Phase 6: Performance Optimizations

- Create baseline performance metrics
- For each optimization, test and iterate while comparing against baseline:
  - Implement viewport culling or LOD
    - It may be less efficient to cull nodes if we are only doing compositing and not actually recalc and reflow. This must be manually verified. In any case, there is still probably a very large threshold to implement viewport culling by, but it may be the case that it's not worth the effort to do.
  - Implement distance culling and LOD
  - (optional) Implement virtualization, prefetching, prerendering, preloading, preconnecting if still necessary

### Phase 7: Extension Migration

- Review all of the most common touch points from extension space
- Determine if any compatibility mappings are still needed, then implement them and add to public API
- Gradually test with more and more frontend extensions

## Performance

### Benchmarking Strategy

- Use existing performance wrapper playwright testing strategy created in https://www.notion.so/drip-art/Analyze-Performance-Impact-of-only-using-Vue-widgets-20b6d73d36508080a14cea0b8dce7073?source=copy_link#20d6d73d365080409a8ccc68f501284e
  - Or, a subset of it

### Optimization Techniques

- Use `will-change: transform` and `transform: translateZ(0)` to force GPU acceleration
- Use `contain: layout style paint` to tell the browser this element won't affect outside layout
- Use `transform-origin` to position the transform pane in accordance with the canvas
- ~~Use `transform: translate3d(round(var(--x), 1px), round(var(--y), 1px), 0)` to snap to pixels during non-animated states~~

### Scaling Targets

- 256 nodes full LOD
- 1000 nodes culled

### Production Monitoring

For desktop users who have consented to telemetry:

- **Mixpanel Events**: Track migration feature adoption and performance metrics
  - Node rendering time percentiles (p50, p90, p99)
  - Frame rate during node interactions
  - Memory usage with different node counts
- **Sentry Performance**: Monitor real-world performance regressions
  - Transaction traces for node operations
  - Custom performance marks for render phases
  - Error rates specific to Vue node rendering

## Extension Compatibility Plan

### Migration Guide

Comprehensive migration documentation will be published at https://docs.comfy.org including:

- Step-by-step migration instructions for common patterns
- Code examples for converting canvas widgets to Vue components
- API compatibility reference
- Performance optimization guidelines

### Compatibility Layer

[Placeholder: Supporting both rendering modes]

### Deprecation Timeline

[Placeholder: List things that will be deprecated fully]

### Developer Communication

- **Email notifications** via existing developer mailing list
- **Discord announcements** in dedicated devrel channel
- **Automated PRs** to affected repositories (if breaking changes required)

## Testing

### Testing Strategy

#### Component Tests

- Create component tests for each widget and node

#### Integration Tests

- Create integration tests for canvas and transform pane synchronization

#### Performance Tests

maybe
 
### Migration of Existing Test Suites

#### Unit Tests

[Placeholder: strategy for migrating unit tests]


#### Browser Tests

[Placeholder: strategy for migrating browser tests]

## Risk Mitigation

### Technical Risks

#### Performance Degradation

- **Risk**: DOM nodes significantly slower than canvas rendering
- **Mitigation**: Aggressive viewport culling, CSS containment, GPU acceleration
- **Monitoring**: Automated performance benchmarks on each PR

#### Memory Usage

- **Risk**: 1000+ DOM nodes consume excessive memory
- **Mitigation**: Component pooling, virtualization for large workflows
- **Detection**: Memory profiling in browser tests

#### Extension Breaking Changes

- **Risk**: Popular extensions stop working
- **Mitigation**: Compatibility layer maintaining critical APIs
- **Testing**: Top 20 extensions tested before each phase

#### State Synchronization Bugs

- **Risk**: LiteGraph and Vue state diverge
- **Mitigation**: Strict one-way data flow, comprehensive event testing
- **Prevention**: State invariant checks in development mode

### Rollback Plan

1. **Feature flag**: `enable_vue_nodes` setting (default: false)
2. **Gradual rollout**: Enable for specific node types first
3. **Quick revert**: Single flag disables all Vue rendering
4. **Data compatibility**: No changes to workflow format ensures backward compatibility

## Timeline and Milestones

### Week 1

[Placeholder: Initial milestones]

### Week 2

[Placeholder: Mid-term milestones]

### Week 3

[Placeholder: Final milestones]

## Open Questions

### Widget Constructor Aliasing

- Why keep old constructors vs. full replacement? (Phase 1, line 53)
- Is this for backwards compatibility with existing extensions?

### Viewport Culling Efficiency

- At what node count does viewport culling become beneficial? (Phase 6, line 89)
- Does the compositing-only benefit outweigh the Vue mount/unmount cost?

### Extension Compatibility

- How much of extension surface area to attempt to cover in compatibility layer?
- Which extension APIs are most critical to preserve?

### Transform Pane Synchronization

- How to handle canvas zoom/pan events?
- Should transform sync be RAF-batched or immediate?

### Event Delegation

- Which events stay on canvas vs. move to DOM?
  - **Option A**: Canvas handles all drag/pan, DOM handles clicks/inputs
  - **Option B**: DOM handles everything except connection dragging
    - *Note: This option provides the best UX - users expect DOM elements to be fully interactive while keeping complex connection logic in canvas*
  - **Option C**: Context-aware delegation based on interaction type

### LOD (Level of Detail) System

- What defines each LOD level?
  - **High**: Full widgets and styling
  - **Medium**: Simplified widgets, reduced effects?
  - **Low**: Title and connections only?
- Transition triggers: zoom level, node count, or performance metrics?
  - *Note: Zoom level as primary trigger is most predictable for users, with node count as override for performance protection*

### Interaction System Migration

- How to maintain gesture consistency between canvas and DOM nodes?
- Multi-select behavior across rendering boundaries?

## Appendices

### A. Prototype Learnings

Detailed findings and discoveries from process of developing Vue widgets and Vue nodes prototype (in vue-node-test branch)

- Constructing components easy, difficulty is performance and compatibility

### B. Performance and Browser Rendering

- https://www.notion.so/drip-art/Analyze-Performance-Impact-of-only-using-Vue-widgets-20b6d73d36508080a14cea0b8dce7073?source=copy_link#20d6d73d365080409a8ccc68f501284e
- https://source.chromium.org/chromium/chromium/src/+/refs/heads/main:third_party/blink/renderer/platform/graphics/compositing_reasons.h;l=18;drc=4e8e81f6eeb6969973f3ec97132d80339b92d227
- https://webperf.tips/tip/browser-rendering-pipeline/
- https://webperf.tips/tip/layers-and-compositing/
- https://webperf.tips/tip/layout-thrashing/

### C. API Design

- https://www.notion.so/drip-art/Widget-Componet-APIs-2126d73d365080b0bf30f241c09dd756