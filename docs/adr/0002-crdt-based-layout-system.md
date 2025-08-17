# 2. CRDT-Based Layout System

Date: 2024-08-16

## Status

Accepted

## Context

ComfyUI's node graph editor faces fundamental architectural limitations that prevent us from achieving our product goals:

### The Problem

In the current system, each node manages its own position directly within LiteGraph. This creates several critical issues:

1. **Performance Degradation**: Every UI update requires traversing the entire graph to detect changes. With graphs containing 100+ nodes, this polling-based approach causes visible lag during interactions.

2. **Snap-Back Hell**: Multiple systems (LiteGraph canvas, Vue widgets, drag handlers) fight over node positions. Users experience frustrating "snap-back" where nodes jump between positions during drag operations.

3. **No Collaboration Path**: Direct mutation of node positions makes real-time collaboration impossible. There's no way to merge concurrent edits from multiple users without conflicts.

4. **Limited Renderer Options**: Position data is tightly coupled to LiteGraph's canvas renderer, blocking us from implementing WebGL rendering for large graphs or accessibility-focused DOM rendering.

5. **Missing Features**: Without a proper event system, we can't implement undo/redo, animation systems, or viewport culling efficiently.

### Why Now?

- User complaints about performance with large workflows are increasing
- The AI art community expects real-time collaboration (see Figma, Miro)
- Accessibility requirements demand alternative rendering modes
- The technical debt is compounding with each new feature

## Decision

We will implement a centralized layout tree using CRDT (Conflict-free Replicated Data Types) as the single source of truth for all spatial data.

### Key Design Choices

1. **CRDT-Based Layout Tree**: Use Yjs to maintain a centralized tree structure that owns all node positions, sizes, and spatial relationships.

2. **Command Pattern**: Every position change is an explicit command/operation rather than direct mutation. This enables:
   - Precise operation history for undo/redo
   - Automatic conflict resolution for concurrent edits
   - Event stream for observers without polling

3. **Unidirectional Data Flow**: 
   ```
   User Input → Layout Commands → CRDT Tree → Renderers
   ```
   LiteGraph becomes a pure renderer that receives position updates, never mutates them.

4. **Spatial Indexing**: The tree structure naturally supports a QuadTree spatial index for O(log n) viewport queries instead of O(n) full scans.

### Why CRDT?

CRDTs solve our core problems elegantly:
- **Local-First**: Works perfectly for single-user while being collaboration-ready
- **Automatic Conflict Resolution**: No more snap-back from competing updates
- **Event-Driven**: Changes propagate through observers, not polling
- **Memory Efficient**: Only changed portions of the tree are updated

### Implementation Approach

Phase 1: Build alongside existing system
- Layout tree observes LiteGraph changes initially
- Gradually migrate interactions to command pattern
- Maintain full backwards compatibility

Phase 2: Invert control
- Layout tree becomes source of truth
- LiteGraph receives updates via one-way sync
- Enable alternative renderers

## Consequences

### Positive

- **10x Performance**: Viewport culling and spatial indexing eliminate full graph traversals
- **Multiplayer Ready**: CRDT foundation enables real-time collaboration without architecture changes
- **Undo/Redo**: Command pattern makes history trivial to implement
- **Renderer Flexibility**: Clean separation allows WebGL, DOM, or hybrid rendering
- **Developer Experience**: Clear data flow and event system simplify debugging

### Negative

- **Learning Curve**: Team needs to understand CRDT concepts and command pattern
- **Migration Complexity**: Existing code must be carefully migrated to new system
- **Initial Memory Overhead**: ~30KB for Yjs library + operation history storage

### Mitigations

- Provide clear migration guides and examples
- Build compatibility layer for gradual migration
- Implement operation history pruning for long-running sessions

## Notes

This architecture aligns with modern state management patterns seen in Figma, Linear, and other collaborative tools. The investment in CRDT infrastructure pays dividends across multiple feature areas and positions ComfyUI as a modern, collaborative AI workflow tool.

The command pattern also opens doors for:
- Macro recording and playback
- Automated testing of UI interactions  
- Remote control via API
- AI-assisted layout optimization

## References

- [Yjs Documentation](https://docs.yjs.dev/)
- [CRDTs: The Hard Parts](https://martin.kleppmann.com/2020/07/06/crdt-hard-parts-hydra.html)
- [Figma's Multiplayer Technology](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)