# Vue Node Resize Tracking Optimization

## Summary

Implemented centralized resize tracking system with O(1) element registration, single ResizeObserver traversal, and extensible ECS architecture to optimize Vue node bounds synchronization.

## Changes

- **What**: Centralized resize registry with single ResizeObserver, optimized math functions for bounds computation, extensible tracking system, DDD-compliant file organization
- **Breaking**: Moved composable from `src/composables/` to `src/renderer/extensions/vueNodes/composables/` (DDD architecture)
- **Dependencies**: None

## Review Focus

### Performance Optimizations
- **Single ResizeObserver**: Replaced per-component observers with centralized registry to minimize browser reflow
- **O(1) Element Access**: Map-based tracking configs eliminate linear searches across element types
- **Single Traversal**: Batch processing groups updates by type in one ResizeObserver callback
- **Optimized Math**: Union bounds computation uses incremental min/max instead of array operations

### Architecture Decisions
- **ECS Pattern**: Element-Component-System design allows tracking different element types (nodes, widgets, slots) with shared infrastructure
- **Extensible Registry**: `trackingConfigs` Map enables adding new element types without core logic changes
- **Data Attribute Strategy**: Uses configurable data attributes (e.g., `data-node-id`) for O(1) element identification vs DOM traversal

### Technical Implementation
- **Yjs Batch Optimization**: Removed race condition check in `batchUpdateNodeBounds` that could drop updates during concurrent transactions
- **Null Safety**: Replaced never-null assertions with proper error handling and null checks
- **Vue Lifecycle Integration**: Automatic cleanup on component unmount prevents memory leaks
- **Type Safety**: Full TypeScript coverage with proper bounds interfaces

### Testing Strategy
- **Component-focused**: Uses Vue Test Utils for realistic DOM integration vs complex unit test mocking
- **Utility Extraction**: Centralized test setup eliminates repetitive mock configuration
- **Injection Mocking**: Proper Vue dependency injection setup for component isolation

### Mathematical Optimizations
- **Bounds Union**: `computeUnionBounds` uses streaming min/max calculation (O(n)) instead of coordinate array operations (O(n log n))
- **Transform Calculations**: Leverages ResizeObserver's native `contentBoxSize` API for accurate dimensions without layout thrashing
