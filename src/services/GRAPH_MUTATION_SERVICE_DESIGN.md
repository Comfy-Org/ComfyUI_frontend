# GraphMutationService Design and Implementation

## Overview

GraphMutationService is the centralized service layer for all graph modification operations in ComfyUI Frontend. It provides a unified and validated API for graph mutations, serving as the single entry point for all graph modification operations.

## Project Background

### Current System Analysis

ComfyUI Frontend uses the LiteGraph library for graph operations, with main components including:

1. **LGraph** (`src/lib/litegraph/src/LGraph.ts`)
   - Core graph management class
   - Provides basic operations like `add()`, `remove()`
   - Supports `beforeChange()`/`afterChange()` transaction mechanism

2. **LGraphNode** (`src/lib/litegraph/src/LGraphNode.ts`)
   - Node class containing position, connections, and other properties
   - Provides methods like `connect()`, `disconnectInput()`, `disconnectOutput()`

3. **ChangeTracker** (`src/scripts/changeTracker.ts`)
   - Existing undo/redo system
   - Snapshot-based history tracking
   - Supports up to 50 history states

**Primary Goals:**
- Single entry point for all graph modifications
- Built-in validation and error handling
- Transaction support for atomic operations
- Natural undo/redo through existing ChangeTracker
- Clean architecture for future extensibility

### Interface-Based Architecture

The GraphMutationService follows an **interface-based design pattern** with singleton state management:

- **IGraphMutationService Interface**: Defines the complete contract for all graph operations
- **GraphMutationService Class**: Implements the interface with LiteGraph integration
- **Singleton State**: Shared clipboard and transaction state across components

```typescript
interface IGraphMutationService {
  // Node operations
  addNode(params: AddNodeParams): Promise<NodeId>
  removeNode(nodeId: NodeId): Promise<void>
  updateNodeProperty(nodeId: NodeId, property: string, value: any): Promise<void>
  // ... 50+ total operations

  // Transaction support
  transaction<T>(fn: () => Promise<T>): Promise<T>
  
  // Undo/Redo
  undo(): Promise<void>
  redo(): Promise<void>
}

class GraphMutationService implements IGraphMutationService {
  // Implementation details...
}
```

The `useGraphMutationService()` hook returns the interface type, maintaining backward compatibility while enabling new architectural benefits.

### Core Components

```typescript
// Interface Definition
interface IGraphMutationService {
  // Complete method signatures for all 50+ operations
  // Organized by functional categories
}

// Implementation Class
class GraphMutationService implements IGraphMutationService {
  private workflowStore = useWorkflowStore()
  private transactionDepth = 0
  private clipboard: ClipboardData | null = null
  
  // All interface methods implemented
}

// Singleton Hook
export const useGraphMutationService = (): IGraphMutationService => {
  if (!graphMutationServiceInstance) {
    graphMutationServiceInstance = new GraphMutationService()
  }
  return graphMutationServiceInstance
}
```


### Validation Framework

Each operation includes validation to ensure data integrity:

```typescript
interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}
```

## Implemented Operations

### Node Operations (6 operations)

| Operation | Description | Original Implementation Reference |
|-----------|-------------|-----------------------------------|
| `addNode` | Add a new node to the graph | src/scripts/app.ts:1589-1593, src/lib/litegraph/src/LGraph.ts:823-893 |
| `removeNode` | Remove a node from the graph | src/lib/litegraph/src/LGraph.ts:899-986 |
| `updateNodeProperty` | Update a custom node property | src/lib/litegraph/src/LGraphNode.ts:974-984 |
| `updateNodeTitle` | Change the node's title | src/services/litegraphService.ts:369 (direct assignment) |
| `changeNodeMode` | Change execution mode (ALWAYS/ON_TRIGGER/NEVER/ON_REQUEST/ON_EVENT) | src/lib/litegraph/src/LGraphNode.ts:1295-1320 |
| `cloneNode` | Create a copy of a node | src/lib/litegraph/src/LGraphNode.ts:923-950 |

### Connection Operations (6 operations)

| Operation | Description | Original Implementation Reference |
|-----------|-------------|-----------------------------------|
| `connect` | Create a connection between nodes | src/lib/litegraph/src/LGraphNode.ts:2641-2743, :2753-2870 (connectSlots) |
| `disconnect` | Generic disconnect (auto-detects input/output) | Wrapper combining disconnectInput/disconnectOutput |
| `disconnectInput` | Disconnect a specific input slot | src/lib/litegraph/src/LGraphNode.ts:3050-3144 |
| `disconnectOutput` | Disconnect all connections from an output slot | src/lib/litegraph/src/LGraphNode.ts:2931-3043 |
| `disconnectOutputTo` | Disconnect output to a specific target node | src/lib/litegraph/src/LGraphNode.ts:2931 (with target_node param) |
| `disconnectLink` | Disconnect by link ID | src/lib/litegraph/src/LGraph.ts:1433-1441 |

### Group Operations (6 operations)

| Operation | Description | Original Implementation Reference |
|-----------|-------------|-----------------------------------|
| `createGroup` | Create a new node group | src/composables/useCoreCommands.ts:425-430, src/lib/litegraph/src/LGraph.ts:823-848 (add method for groups) |
| `removeGroup` | Delete a group (nodes remain) | src/lib/litegraph/src/LGraph.ts:899-913 (remove method for groups) |
| `updateGroupTitle` | Change group title | Direct assignment (group.title = value) |
| `moveGroup` | Move group and its contents | src/lib/litegraph/src/LGraphGroup.ts:230-240 |
| `addNodesToGroup` | Add nodes to group and auto-resize | src/lib/litegraph/src/LGraphGroup.ts:303-306 |
| `recomputeGroupNodes` | Recalculate which nodes are in group | src/lib/litegraph/src/LGraphGroup.ts:247-273 |

### Subgraph Node Slot Operations (4 operations)

| Operation | Description | Original Implementation Reference |
|-----------|-------------|-----------------------------------|
| `addSubgraphNodeInput` | Add an input slot to a subgraph node | src/lib/litegraph/src/LGraphNode.ts:1606-1627 |
| `addSubgraphNodeOutput` | Add an output slot to a subgraph node | src/lib/litegraph/src/LGraphNode.ts:1551-1571 |
| `removeSubgraphNodeInput` | Remove an input slot from a subgraph node | src/lib/litegraph/src/LGraphNode.ts:1632-1652 |
| `removeSubgraphNodeOutput` | Remove an output slot from a subgraph node | src/lib/litegraph/src/LGraphNode.ts:1576-1599 |

### Batch Operations (3 operations)

| Operation | Description | Original Implementation Reference |
|-----------|-------------|-----------------------------------|
| `addNodes` | Add multiple nodes in one operation | Custom implementation based on single addNode logic |
| `removeNodes` | Remove multiple nodes in one operation | src/composables/useCoreCommands.ts:180 (forEach pattern) |
| `duplicateNodes` | Duplicate selected nodes with their connections | src/utils/vintageClipboard.ts:32 (node.clone pattern) |

### Clipboard Operations (6 operations)

| Operation | Description | Original Implementation Reference |
|-----------|-------------|-----------------------------------|
| `copyNodes` | Copy nodes to clipboard | src/lib/litegraph/src/LGraphCanvas.ts:3602-3687 |
| `cutNodes` | Cut nodes to clipboard | Custom implementation (copy + mark for deletion) |
| `pasteNodes` | Paste nodes from clipboard | src/lib/litegraph/src/LGraphCanvas.ts:3693-3871 |
| `getClipboard` | Get current clipboard content | Custom implementation (returns internal clipboard) |
| `clearClipboard` | Clear clipboard content | Custom implementation (sets clipboard to null) |
| `hasClipboardContent` | Check if clipboard has content | Custom implementation (checks clipboard state) |

### Reroute Operations (2 operations)

| Operation | Description | Original Implementation Reference |
|-----------|-------------|-----------------------------------|
| `addReroute` | Add a reroute point on a connection | src/lib/litegraph/src/LGraph.ts:1338-1361 (createReroute) |
| `removeReroute` | Remove a reroute point | src/lib/litegraph/src/LGraph.ts:1381-1407 |

### Subgraph Operations (6 operations)

| Operation | Description | Original Implementation Reference |
|-----------|-------------|-----------------------------------|
| `createSubgraph` | Create a subgraph from selected nodes | src/lib/litegraph/src/LGraph.ts:1459-1566 (convertToSubgraph) |
| `unpackSubgraph` | Unpack a subgraph node back into regular nodes | src/lib/litegraph/src/LGraph.ts:1672-1841 |
| `addSubgraphInput` | Add an input to a subgraph | src/lib/litegraph/src/LGraph.ts:2440-2456 |
| `addSubgraphOutput` | Add an output to a subgraph | src/lib/litegraph/src/LGraph.ts:2458-2474 |
| `removeSubgraphInput` | Remove a subgraph input | src/lib/litegraph/src/LGraph.ts:2520-2535 |
| `removeSubgraphOutput` | Remove a subgraph output | src/lib/litegraph/src/LGraph.ts:2541-2559 |

### Graph-level Operations (1 operations)

| Operation | Description | Original Implementation Reference |
|-----------|-------------|-----------------------------------|
| `clearGraph` | Clear all nodes and connections | src/lib/litegraph/src/LGraph.ts:293-362 |

### Execution Control Operations (2 operations)

| Operation | Description | Original Implementation Reference |
|-----------|-------------|-----------------------------------|
| `bypassNode` | Set node to bypass mode (never execute) | Direct mode assignment (node.mode = LGraphEventMode.BYPASS) |
| `unbypassNode` | Set node to normal mode (always execute) | Direct mode assignment (node.mode = LGraphEventMode.ALWAYS) |

### Transaction and History Operations (3 operations)

| Operation | Description | Original Implementation Reference |
|-----------|-------------|-----------------------------------|
| `transaction` | Execute multiple operations atomically | Custom implementation using beforeChange/afterChange |
| `undo` | Undo the last operation | src/scripts/changeTracker.ts (uses changeTracker.undo) |
| `redo` | Redo the previously undone operation | src/scripts/changeTracker.ts (uses changeTracker.redo) |

## Usage Examples

### Basic Node Operations

```typescript
import { useGraphMutationService } from '@/services/graphMutationService'

const service = useGraphMutationService()

// Add a node
const nodeId = await service.addNode({
  type: 'LoadImage',
  pos: [100, 100],
  title: 'Image Loader'
})

// Update node properties
await service.updateNodeTitle(nodeId, 'My Image')
await service.updateNodeProperty(nodeId, 'seed', 12345)

// Clone a node
const clonedId = await service.cloneNode(nodeId, [300, 200])
```

### Connection Management

```typescript
// Create a connection
const linkId = await service.connect({
  sourceNodeId: node1Id,
  sourceSlot: 0,
  targetNodeId: node2Id,
  targetSlot: 0
})

// Various disconnect methods
await service.disconnectInput(node2Id, 0)
await service.disconnectOutput(node1Id, 0)
await service.disconnectLink(linkId)
```

### Group Management

```typescript
// Create a group
const groupId = await service.createGroup({
  title: 'Image Processing',
  pos: [100, 100],
  size: [400, 300],
  color: '#335577'
})

// Manage group content
await service.addNodesToGroup(groupId, [node1Id, node2Id])
await service.moveGroup(groupId, 50, 100) // deltaX, deltaY
await service.resizeGroup(groupId, [500, 400])
```


### Batch Operations

```typescript
// Add multiple nodes
const nodeIds = await service.addNodes([
  { type: 'LoadImage', pos: [100, 100] },
  { type: 'VAEEncode', pos: [300, 100] },
  { type: 'KSampler', pos: [500, 100] }
])

// Duplicate with connections preserved
const duplicatedIds = await service.duplicateNodes(
  [node1Id, node2Id, node3Id],
  [100, 100] // offset
)

// Batch delete
await service.removeNodes([node1Id, node2Id, node3Id])
```

### Clipboard Operations

```typescript
// Copy/Cut/Paste workflow
await service.copyNodes([node1Id, node2Id])
await service.cutNodes([node3Id, node4Id])

const pastedNodes = await service.pasteNodes([200, 200])

// Check clipboard
if (service.hasClipboardContent()) {
  const clipboard = service.getClipboard()
  console.log(`${clipboard.nodes.length} nodes in clipboard`)
}
```

### Transactions

```typescript
// Atomic operations
await service.transaction(async () => {
  const node1 = await service.addNode({ type: 'LoadImage' })
  const node2 = await service.addNode({ type: 'SaveImage' })
  await service.connect({
    sourceNodeId: node1,
    sourceSlot: 0,
    targetNodeId: node2,
    targetSlot: 0
  })
})

// Entire transaction can be undone as one operation
await service.undo()
```

### Graph-level Operations

```typescript
// Clear entire graph
await service.clearGraph()

// Distribute nodes evenly
await service.distributeNodes([node1Id, node2Id, node3Id], 'horizontal')
```

### Execution Control

```typescript
// Bypass node (set to never execute)
await service.bypassNode(nodeId)

// Re-enable node execution
await service.unbypassNode(nodeId)
```

### Subgraph Operations

```typescript
// Create subgraph from selected nodes
const subgraphId = await service.createSubgraph({
  name: 'Image Processing',
  nodeIds: [node1Id, node2Id, node3Id]
})

// Configure subgraph I/O
await service.addSubgraphInput(subgraphId, 'image', 'IMAGE')
await service.addSubgraphOutput(subgraphId, 'result', 'IMAGE')

// Add dynamic slots to subgraph nodes
await service.addSubgraphNodeInput({
  nodeId: subgraphNodeId,
  name: 'extra_input',
  type: 'LATENT'
})
```

## Implementation Details

### Integration Points

1. **LiteGraph Integration**
   - Uses `app.graph` for graph access
   - Calls `beforeChange()`/`afterChange()` for transactions
   - Integrates with existing LiteGraph node/connection APIs

2. **ChangeTracker Integration**
   - Maintains compatibility with existing undo/redo system
   - Calls `checkState()` after operations
   - Provides undo/redo through existing tracker

## Validation System

### Current Validations (Placeholder)

- `validateAddNode()` - Check node type exists
- `validateRemoveNode()` - Check node can be removed
- `validateConnect()` - Check connection compatibility
- `validateUpdateNodePosition()` - Check position bounds

### Future Validations

- Type compatibility checking
- Circular dependency detection
- Resource limit enforcement
- Permission validation
- Business rule enforcement

## Technical Decisions

### Why Validation Layer?
- **Data Integrity**: Prevent invalid graph states
- **User Experience**: Early error detection
- **Security**: Prevent malicious operations
- **Extensibility**: Easy to add new rules

### Why Transaction Support?
- **Atomicity**: Multiple operations succeed or fail together
- **Consistency**: Graph remains valid throughout
- **User Experience**: Natural undo/redo boundaries

## Related Files

- **Interface Definition**: `src/services/IGraphMutationService.ts`
- **Implementation**: `src/services/GraphMutationService.ts` 
- **LiteGraph Core**: `src/lib/litegraph/src/LGraph.ts`
- **Node Implementation**: `src/lib/litegraph/src/LGraphNode.ts`
- **Change Tracking**: `src/scripts/changeTracker.ts`

## Implementation Compatibility Notes

### Critical Implementation Details to Maintain:

1. **beforeChange/afterChange Pattern**
   - All mutations MUST be wrapped with `graph.beforeChange()` and `graph.afterChange()`
   - This enables undo/redo functionality through ChangeTracker
   - Reference: `src/scripts/changeTracker.ts:200-208`

2. **Node ID Management**
   - Node IDs can be numbers or strings (for API compatibility)
   - Reference: `src/scripts/app.ts:1591` - `node.id = isNaN(+id) ? id : +id`

3. **Clipboard Implementation**
   - Current implementation uses localStorage for persistence
   - Must maintain compatibility with existing clipboard format
   - Reference: `src/lib/litegraph/src/LGraphCanvas.ts:3602-3857`

4. **Group Resizing**
   - Groups should auto-resize when adding nodes using `recomputeInsideNodes()`
   - Reference: `src/composables/useCoreCommands.ts:430` - `group.resizeTo()`

5. **Canvas Dirty Flag**
   - Visual operations (groups, reroutes) must call `graph.setDirtyCanvas(true, false)`
   - This triggers canvas redraw

6. **Error Handling**
   - Node creation can return null (for invalid types)
   - Connection operations return null/false on failure
   - Must validate before operations

7. **Subgraph Support**
   - Subgraph operations use specialized Subgraph and SubgraphNode classes
   - Reference: `src/lib/litegraph/src/subgraph/`

## Migration Strategy

1. Start by replacing direct `app.graph.add()` calls with `graphMutationService.addNode()`
2. Replace `graph.remove()` calls with `graphMutationService.removeNode()`
3. Update connection operations to use service methods
4. Migrate clipboard operations to use centralized service
5. Ensure all operations maintain existing beforeChange/afterChange patterns

## Important Notes

1. **Always use GraphMutationService** - Never call graph methods directly
2. **Backward Compatibility** - Service maintains compatibility with existing code
3. **Gradual Migration** - Existing code can be migrated incrementally
4. **Performance** - Command recording has minimal overhead