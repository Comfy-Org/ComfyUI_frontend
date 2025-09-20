# GraphMutationService Design and Implementation

## Overview

GraphMutationService is the centralized service layer for all graph modification operations in ComfyUI Frontend. It provides a unified, command-based API for graph mutations with built-in error handling through the Result pattern, serving as the single entry point for all graph modification operations.

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
- Single entry point for all graph modifications via command pattern
- Built-in validation and error handling through Result pattern
- Transaction support for atomic operations
- Natural undo/redo through existing ChangeTracker
- Clean architecture for future extensibility (CRDT support ready)
- Comprehensive error context preservation

## Architecture Patterns

### Command Pattern
All operations are executed through a unified command interface:

```typescript
interface GraphMutationOperation {
  type: string // Operation type identifier
  timestamp: number // For ordering and CRDT support
  origin: CommandOrigin // Source of the command
  params?: any // Operation-specific parameters
}
```

### Result Pattern
All operations return a discriminated union Result type instead of throwing exceptions:

```typescript
type Result<T, E> =
  | { success: true; data: T }
  | { success: false; error: E }
```

### Error Handling
Custom error class with rich context:

```typescript
class GraphMutationError extends Error {
  code: string
  context: Record<string, any> // Contains operation details and original error
}
```

### Interface-Based Architecture

The GraphMutationService follows an **interface-based design pattern** with singleton state management:

- **IGraphMutationService Interface**: Defines the complete contract for all graph operations
- **GraphMutationService Class**: Implements the interface with LiteGraph integration
- **Singleton State**: Shared clipboard and transaction state across components

```typescript
interface IGraphMutationService {
  // Central command dispatcher
  applyOperation(
    operation: GraphMutationOperation
  ): Promise<Result<any, GraphMutationError>>

  // Direct operation methods (all return Result types)
  createNode(params: createNodeParams): Promise<Result<NodeId, GraphMutationError>>
  removeNode(nodeId: NodeId): Promise<Result<void, GraphMutationError>>
  // ... 40+ total operations

  // Undo/Redo
  undo(): Promise<Result<void, GraphMutationError>>
  redo(): Promise<Result<void, GraphMutationError>>
}
```

### Core Components

```typescript
// Implementation Class
class GraphMutationService implements IGraphMutationService {
  private workflowStore = useWorkflowStore()
  private static readonly CLIPBOARD_KEY = 'litegrapheditor_clipboard'

  // Command dispatcher
  async applyOperation(
    operation: GraphMutationOperation
  ): Promise<Result<any, GraphMutationError>> {
    switch (operation.type) {
      case 'createNode':
        return await this.createNode(operation.params)
      case 'removeNode':
        return await this.removeNode(operation.params)
      // ... handle all operation types
      default:
        return {
          success: false,
          error: new GraphMutationError('Unknown operation type', {
            operation: operation.type
          })
        }
    }
  }

  // All operations wrapped with error handling
  async createNode(params: createNodeParams): Promise<Result<NodeId, GraphMutationError>> {
    try {
      const graph = this.getGraph()
      graph.beforeChange()
      // ... perform operation
      graph.afterChange()
      return { success: true, data: nodeId }
    } catch (error) {
      return {
        success: false,
        error: new GraphMutationError('Failed to create node', {
          operation: 'createNode',
          params,
          cause: error
        })
      }
    }
  }
}

// Singleton Hook
export const useGraphMutationService = (): IGraphMutationService => {
  if (!graphMutationServiceInstance) {
    graphMutationServiceInstance = new GraphMutationService()
  }
  return graphMutationServiceInstance
}
```

## Implemented Operations

### Node Operations (8 operations)

| Operation | Description | Result Type |
|-----------|-------------|-------------|
| `createNode` | Create a new node in the graph | `Result<NodeId, GraphMutationError>` |
| `removeNode` | Remove a node from the graph | `Result<void, GraphMutationError>` |
| `updateNodeProperty` | Update a custom node property | `Result<void, GraphMutationError>` |
| `updateNodeTitle` | Change the node's title | `Result<void, GraphMutationError>` |
| `changeNodeMode` | Change execution mode (ALWAYS/BYPASS/etc) | `Result<void, GraphMutationError>` |
| `cloneNode` | Create a copy of a node | `Result<NodeId, GraphMutationError>` |
| `bypassNode` | Set node to bypass mode | `Result<void, GraphMutationError>` |
| `unbypassNode` | Remove bypass mode from node | `Result<void, GraphMutationError>` |

### Connection Operations (3 operations)

| Operation | Description | Result Type |
|-----------|-------------|-------------|
| `connect` | Create a connection between nodes | `Result<LinkId, GraphMutationError>` |
| `disconnect` | Disconnect a node input/output slot | `Result<boolean, GraphMutationError>` |
| `disconnectLink` | Disconnect by link ID | `Result<void, GraphMutationError>` |

### Group Operations (5 operations)

| Operation | Description | Result Type |
|-----------|-------------|-------------|
| `createGroup` | Create a new node group | `Result<GroupId, GraphMutationError>` |
| `removeGroup` | Delete a group (nodes remain) | `Result<void, GraphMutationError>` |
| `updateGroupTitle` | Change group title | `Result<void, GraphMutationError>` |
| `addNodesToGroup` | Add nodes to group and auto-resize | `Result<void, GraphMutationError>` |
| `recomputeGroupNodes` | Recalculate which nodes are in group | `Result<void, GraphMutationError>` |

### Clipboard Operations (3 operations)

| Operation | Description | Result Type |
|-----------|-------------|-------------|
| `copyNodes` | Copy nodes to clipboard | `Result<void, GraphMutationError>` |
| `cutNodes` | Cut nodes to clipboard | `Result<void, GraphMutationError>` |
| `pasteNodes` | Paste nodes from clipboard | `Result<NodeId[], GraphMutationError>` |

### Reroute Operations (2 operations)

| Operation | Description | Result Type |
|-----------|-------------|-------------|
| `addReroute` | Add a reroute point on a connection | `Result<RerouteId, GraphMutationError>` |
| `removeReroute` | Remove a reroute point | `Result<void, GraphMutationError>` |

### Subgraph Operations (10 operations)

| Operation | Description | Result Type |
|-----------|-------------|-------------|
| `createSubgraph` | Create a subgraph from selected items | `Result<{subgraph, node}, GraphMutationError>` |
| `unpackSubgraph` | Unpack a subgraph node back into regular nodes | `Result<void, GraphMutationError>` |
| `addSubgraphNodeInput` | Add input slot to subgraph node | `Result<number, GraphMutationError>` |
| `addSubgraphNodeOutput` | Add output slot to subgraph node | `Result<number, GraphMutationError>` |
| `removeSubgraphNodeInput` | Remove input slot from subgraph node | `Result<void, GraphMutationError>` |
| `removeSubgraphNodeOutput` | Remove output slot from subgraph node | `Result<void, GraphMutationError>` |
| `addSubgraphInput` | Add an input to a subgraph | `Result<void, GraphMutationError>` |
| `addSubgraphOutput` | Add an output to a subgraph | `Result<void, GraphMutationError>` |
| `removeSubgraphInput` | Remove a subgraph input | `Result<void, GraphMutationError>` |
| `removeSubgraphOutput` | Remove a subgraph output | `Result<void, GraphMutationError>` |

### Graph-level Operations (1 operation)

| Operation | Description | Result Type |
|-----------|-------------|-------------|
| `clearGraph` | Clear all nodes and connections | `Result<void, GraphMutationError>` |

### History Operations (2 operations)

| Operation | Description | Result Type |
|-----------|-------------|-------------|
| `undo` | Undo the last operation | `Result<void, GraphMutationError>` |
| `redo` | Redo the previously undone operation | `Result<void, GraphMutationError>` |

## Usage Examples

### Command Pattern Usage

```typescript
import { useGraphMutationService, CommandOrigin } from '@/core/graph/operations'
import type { GraphMutationOperation } from '@/core/graph/operations/types'

const service = useGraphMutationService()

// Execute operations via command pattern
const operation: GraphMutationOperation = {
  type: 'createNode',
  timestamp: Date.now(),
  origin: CommandOrigin.Local,
  params: {
    type: 'LoadImage',
    title: 'My Image Loader',
    properties: { seed: 12345 }
  }
}

const result = await service.applyOperation(operation)

if (result.success) {
  console.log('Node created with ID:', result.data)
} else {
  console.error('Failed:', result.error.message)
  console.error('Context:', result.error.context)
}
```

### Direct Method Usage with Result Pattern

```typescript
// All methods return Result<T, GraphMutationError>
const result = await service.createNode({
  type: 'LoadImage',
  title: 'Image Loader'
})

if (result.success) {
  const nodeId = result.data

  // Update node properties
  const updateResult = await service.updateNodeProperty({
    nodeId,
    property: 'seed',
    value: 12345
  })

  if (!updateResult.success) {
    console.error('Update failed:', updateResult.error)
  }
} else {
  // Access detailed error context
  const { operation, params, cause } = result.error.context
  console.error(`Operation ${operation} failed:`, cause)
}
```

### Connection Management

```typescript
// Create a connection
const connectOp: GraphMutationOperation = {
  type: 'connect',
  timestamp: Date.now(),
  origin: CommandOrigin.Local,
  params: {
    sourceNodeId: node1Id,
    sourceSlot: 0,
    targetNodeId: node2Id,
    targetSlot: 0
  }
}

const result = await service.applyOperation(connectOp)

if (result.success) {
  const linkId = result.data

  // Later disconnect by link ID
  const disconnectResult = await service.disconnectLink(linkId)

  if (!disconnectResult.success) {
    console.error('Disconnect failed:', disconnectResult.error)
  }
}
```

### Group Management

```typescript
// Create a group via command
const createGroupOp: GraphMutationOperation = {
  type: 'createGroup',
  timestamp: Date.now(),
  origin: CommandOrigin.Local,
  params: {
    title: 'Image Processing',
    size: [400, 300],
    color: '#335577'
  }
}

const groupResult = await service.applyOperation(createGroupOp)

if (groupResult.success) {
  const groupId = groupResult.data

  // Add nodes to group
  const addNodesResult = await service.addNodesToGroup({
    groupId,
    nodeIds: [node1Id, node2Id]
  })

  if (!addNodesResult.success) {
    console.error('Failed to add nodes:', addNodesResult.error)
  }
}
```

### Clipboard Operations

```typescript
// Copy nodes
const copyResult = await service.copyNodes([node1Id, node2Id])

if (copyResult.success) {
  // Paste at a different location
  const pasteResult = await service.pasteNodes()

  if (pasteResult.success) {
    console.log('Pasted nodes:', pasteResult.data)
  } else {
    console.error('Paste failed:', pasteResult.error)
  }
}

// Cut operation
const cutResult = await service.cutNodes([node3Id])
// Original nodes marked for deletion after paste
```

### Error Context Preservation

```typescript
const result = await service.updateNodeProperty({
  nodeId: 'invalid-node',
  property: 'seed',
  value: 12345
})

if (!result.success) {
  // Rich error context available
  console.error('Error:', result.error.message)
  console.error('Code:', result.error.code)
  console.error('Operation:', result.error.context.operation)
  console.error('Parameters:', result.error.context.params)
  console.error('Original error:', result.error.context.cause)
}
```

### Subgraph Operations

```typescript
// Create subgraph from selected items
const subgraphOp: GraphMutationOperation = {
  type: 'createSubgraph',
  timestamp: Date.now(),
  origin: CommandOrigin.Local,
  params: {
    selectedItems: new Set([node1, node2, node3])
  }
}

const result = await service.applyOperation(subgraphOp)

if (result.success) {
  const { subgraph, node } = result.data

  // Add I/O to subgraph
  await service.addSubgraphInput({
    subgraphId: subgraph.id,
    name: 'image',
    type: 'IMAGE'
  })
}
```

### History Operations

```typescript
// All operations are undoable
const result = await service.undo()

if (result.success) {
  console.log('Undo successful')
} else {
  console.error('Undo failed:', result.error.message)
  // Might fail if no history or change tracker unavailable
}

// Redo
const redoResult = await service.redo()
```

## Implementation Details

### Integration Points

1. **LiteGraph Integration**
   - Uses `app.graph` for graph access
   - Calls `beforeChange()`/`afterChange()` for all mutations
   - Integrates with existing LiteGraph node/connection APIs

2. **ChangeTracker Integration**
   - Maintains compatibility with existing undo/redo system
   - Transactions wrapped with `beforeChange()`/`afterChange()`
   - No longer calls `checkState()` directly (removed from new implementation)

3. **Error Handling**
   - All operations wrapped in try-catch blocks
   - Errors converted to GraphMutationError with context
   - Original errors preserved in context.cause

## Technical Decisions

### Why Command Pattern?
- **Uniformity**: Single entry point for all operations
- **Extensibility**: Easy to add new operations
- **CRDT Ready**: Commands include timestamp and origin for future sync
- **Testing**: Easy to test command dispatch and execution

### Why Result Pattern?
- **Explicit Error Handling**: Forces consumers to handle errors
- **No Exceptions**: Predictable control flow
- **Rich Context**: Errors carry operation context
- **Type Safety**: TypeScript discriminated unions

### Why GraphMutationError?
- **Context Preservation**: Maintains full operation context
- **Debugging**: Detailed information for troubleshooting
- **Standardization**: Consistent error structure
- **Traceability**: Links errors to specific operations

## Related Files

- **Interface Definition**: `src/core/graph/operations/IGraphMutationService.ts`
- **Implementation**: `src/core/graph/operations/graphMutationService.ts`
- **Types**: `src/core/graph/operations/types.ts`
- **Error Class**: `src/core/graph/operations/GraphMutationError.ts`
- **Tests**: `tests-ui/tests/services/graphMutationService.test.ts`
- **LiteGraph Core**: `src/lib/litegraph/src/LGraph.ts`
- **Node Implementation**: `src/lib/litegraph/src/LGraphNode.ts`
- **Change Tracking**: `src/scripts/changeTracker.ts`

## Implementation Compatibility Notes

### Critical Implementation Details to Maintain:

1. **beforeChange/afterChange Pattern**
   - All mutations MUST be wrapped with `graph.beforeChange()` and `graph.afterChange()`
   - This enables undo/redo functionality through ChangeTracker
   - Reference: Pattern used consistently throughout service

2. **Node ID Management**
   - Node IDs use NodeId type from schemas
   - Custom IDs can be provided during creation (for workflow loading)

3. **Clipboard Implementation**
   - Uses localStorage with key 'litegrapheditor_clipboard'
   - Maintains node connections during copy/paste
   - Cut operation marks nodes for deletion after paste

4. **Group Management**
   - Groups auto-resize when adding nodes using `recomputeInsideNodes()`
   - Visual operations call `graph.setDirtyCanvas(true, false)`

5. **Error Handling**
   - All operations return Result<T, GraphMutationError>
   - Never throw exceptions from public methods
   - Preserve original error in context.cause

6. **Subgraph Support**
   - Uses instanceof checks for SubgraphNode detection
   - Iterates through graph._nodes to find subgraphs

## Migration Strategy

1. Replace direct graph method calls with service operations
2. Update error handling from try-catch to Result pattern checking
3. Convert operation calls to use command pattern where beneficial
4. Leverage error context for better debugging
5. Ensure all operations maintain existing beforeChange/afterChange patterns

## Important Notes

1. **Always use GraphMutationService** - Never call graph methods directly
2. **Handle Result types** - Check success before using data
3. **Preserve error context** - Log full error context for debugging
4. **Command pattern ready** - Can easily add CRDT sync in future
5. **Performance** - Result pattern and command recording have minimal overhead
6. **Type safety** - Use TypeScript types for all operations