# Unit Testing Guide

This guide covers patterns and examples for unit testing utilities, composables, and other non-component code in the ComfyUI Frontend codebase.

## Table of Contents

1. [Testing Vue Composables with Reactivity](#testing-vue-composables-with-reactivity)
2. [Working with LiteGraph and Nodes](#working-with-litegraph-and-nodes)
3. [Working with Workflow JSON Files](#working-with-workflow-json-files)
4. [Mocking the API Object](#mocking-the-api-object)
5. [Mocking Lodash Functions](#mocking-lodash-functions)
6. [Testing with Debounce and Throttle](#testing-with-debounce-and-throttle)
7. [Mocking Node Definitions](#mocking-node-definitions)


## Testing Vue Composables with Reactivity

Testing Vue composables requires handling reactivity correctly:

```typescript
// Example from: tests-ui/tests/composables/useServerLogs.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useServerLogs } from '@/composables/useServerLogs'

// Mock dependencies
vi.mock('@/scripts/api', () => ({
  api: {
    subscribeLogs: vi.fn()
  }
}))

describe('useServerLogs', () => {
  it('should update reactive logs when receiving events', async () => {
    const { logs, startListening } = useServerLogs()
    await startListening()

    // Simulate log event handler being called
    const mockHandler = vi.mocked(useEventListener).mock.calls[0][2]
    mockHandler(new CustomEvent('logs', {
      detail: {
        type: 'logs',
        entries: [{ m: 'Log message' }]
      }
    }))
    
    // Must wait for Vue reactivity to update
    await nextTick()
    
    expect(logs.value).toEqual(['Log message'])
  })
})
```

## Working with LiteGraph and Nodes

Testing LiteGraph-related functionality:

```typescript
// Example from: tests-ui/tests/litegraph.test.ts
import { LGraph, LGraphNode, LiteGraph } from '@comfyorg/litegraph'
import { describe, expect, it } from 'vitest'

// Create dummy node for testing
class DummyNode extends LGraphNode {
  constructor() {
    super('dummy')
  }
}

describe('LGraph', () => {
  it('should serialize graph nodes', async () => {
    // Register node type
    LiteGraph.registerNodeType('dummy', DummyNode)
    
    // Create graph with nodes
    const graph = new LGraph()
    const node = new DummyNode()
    graph.add(node)
    
    // Test serialization
    const result = graph.serialize()
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].type).toBe('dummy')
  })
})
```

## Working with Workflow JSON Files

Testing with ComfyUI workflow files:

```typescript
// Example from: tests-ui/tests/comfyWorkflow.test.ts
import { describe, expect, it } from 'vitest'
import { validateComfyWorkflow } from '@/schemas/comfyWorkflowSchema'
import { defaultGraph } from '@/scripts/defaultGraph'

describe('workflow validation', () => {
  it('should validate default workflow', async () => {
    const validWorkflow = JSON.parse(JSON.stringify(defaultGraph))
    
    // Validate workflow
    const result = await validateComfyWorkflow(validWorkflow)
    expect(result).not.toBeNull()
  })
  
  it('should handle position format conversion', async () => {
    const workflow = JSON.parse(JSON.stringify(defaultGraph))
    
    // Legacy position format as object
    workflow.nodes[0].pos = { '0': 100, '1': 200 }
    
    // Should convert to array format
    const result = await validateComfyWorkflow(workflow)
    expect(result.nodes[0].pos).toEqual([100, 200])
  })
})
```

## Mocking the API Object

Mocking the ComfyUI API object:

```typescript
// Example from: tests-ui/tests/composables/useServerLogs.test.ts
import { describe, expect, it, vi } from 'vitest'
import { api } from '@/scripts/api'

// Mock the api object
vi.mock('@/scripts/api', () => ({
  api: {
    subscribeLogs: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
}))

it('should subscribe to logs API', () => {
  // Call function that uses the API
  startListening()
  
  // Verify API was called correctly
  expect(api.subscribeLogs).toHaveBeenCalledWith(true)
})
```

## Mocking Lodash Functions

Mocking lodash functions like debounce:

```typescript
// Mock debounce to execute immediately
import { debounce } from 'lodash-es'

vi.mock('lodash-es', () => ({
  debounce: vi.fn((fn) => {
    // Return function that calls the input function immediately
    const mockDebounced = (...args: any[]) => fn(...args)
    // Add cancel method that lodash debounced functions have
    mockDebounced.cancel = vi.fn()
    return mockDebounced
  })
}))

describe('Function using debounce', () => {
  it('calls debounced function immediately in tests', () => {
    const mockFn = vi.fn()
    const debouncedFn = debounce(mockFn, 1000)
    
    debouncedFn()
    
    // No need to wait - our mock makes it execute immediately
    expect(mockFn).toHaveBeenCalled()
  })
})
```

## Testing with Debounce and Throttle

When you need to test real debounce/throttle behavior:

```typescript
// Example from: tests-ui/tests/composables/useWorkflowAutoSave.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('debounced function', () => {
  beforeEach(() => {
    vi.useFakeTimers() // Use fake timers to control time
  })

  afterEach(() => {
    vi.useRealTimers() 
  })

  it('should debounce function calls', () => {
    const mockFn = vi.fn()
    const debouncedFn = debounce(mockFn, 1000)
    
    // Call multiple times
    debouncedFn()
    debouncedFn()
    debouncedFn()
    
    // Function not called yet (debounced)
    expect(mockFn).not.toHaveBeenCalled()
    
    // Advance time just before debounce period
    vi.advanceTimersByTime(999)
    expect(mockFn).not.toHaveBeenCalled()
    
    // Advance to debounce completion
    vi.advanceTimersByTime(1)
    expect(mockFn).toHaveBeenCalledTimes(1)
  })
})
```

## Mocking Node Definitions

Creating mock node definitions for testing:

```typescript
// Example from: tests-ui/tests/apiTypes.test.ts
import { describe, expect, it } from 'vitest'
import { type ComfyNodeDef, validateComfyNodeDef } from '@/schemas/nodeDefSchema'

// Create a complete mock node definition
const EXAMPLE_NODE_DEF: ComfyNodeDef = {
  input: {
    required: {
      ckpt_name: [['model1.safetensors', 'model2.ckpt'], {}]
    }
  },
  output: ['MODEL', 'CLIP', 'VAE'],
  output_is_list: [false, false, false],
  output_name: ['MODEL', 'CLIP', 'VAE'],
  name: 'CheckpointLoaderSimple',
  display_name: 'Load Checkpoint',
  description: '',
  python_module: 'nodes',
  category: 'loaders',
  output_node: false,
  experimental: false,
  deprecated: false
}

it('should validate node definition', () => {
  expect(validateComfyNodeDef(EXAMPLE_NODE_DEF)).not.toBeNull()
})
```