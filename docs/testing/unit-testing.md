# Unit Testing Guide

This guide covers patterns and examples for unit testing utilities, composables, and other non-component code in the ComfyUI Frontend codebase.

## Table of Contents

1. [Testing Vue Composables with Reactivity](#testing-vue-composables-with-reactivity)
2. [Working with LiteGraph and Nodes](#working-with-litegraph-and-nodes)
3. [Working with Workflow JSON Files](#working-with-workflow-json-files)
4. [Mocking the API Object](#mocking-the-api-object)
5. [Mocking Utility Functions](#mocking-utility-functions)
6. [Testing with Debounce and Throttle](#testing-with-debounce-and-throttle)
7. [Mocking Node Definitions](#mocking-node-definitions)
8. [Mocking Composables with Reactive State](#mocking-composables-with-reactive-state)

## Testing Vue Composables with Reactivity

Testing Vue composables requires handling reactivity correctly:

```typescript
// Example from a colocated composable unit test
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
    mockHandler(
      new CustomEvent('logs', {
        detail: {
          type: 'logs',
          entries: [{ m: 'Log message' }]
        }
      })
    )

    // Must wait for Vue reactivity to update
    await nextTick()

    expect(logs.value).toEqual(['Log message'])
  })
})
```

## Working with LiteGraph and Nodes

Testing LiteGraph-related functionality:

```typescript
// Example from a colocated LiteGraph unit test
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph'
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
// Example from a colocated workflow unit test
import { describe, expect, it } from 'vitest'
import { validateComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
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
// Example from a colocated composable unit test
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

## Mocking Utility Functions from es-toolkit

The codebase uses `es-toolkit` for utility functions (not lodash). When mocking functions like debounce, you have two approaches:

### Approach 1: Partial Mock with vi.importActual (Recommended)

This preserves other utilities while mocking only what you need:

```typescript
import { debounce } from 'es-toolkit/compat'

vi.mock('es-toolkit/compat', async () => {
  const actual = await vi.importActual('es-toolkit/compat')
  return {
    ...actual,
    debounce: <T extends (...args: unknown[]) => unknown>(fn: T) => fn
  }
})

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

### Approach 2: Full Mock for Immediate Execution

```typescript
import { debounce } from 'es-toolkit/compat'

vi.mock('es-toolkit/compat', () => ({
  debounce: vi.fn((fn) => {
    // Return function that calls the input function immediately
    const mockDebounced = (...args: any[]) => fn(...args)
    // Add cancel method that debounced functions have
    mockDebounced.cancel = vi.fn()
    return mockDebounced
  })
}))
```

## Testing with Debounce and Throttle

When you need to test real debounce/throttle behavior:

```typescript
// Example from a colocated composable unit test
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
// Example from a colocated schema unit test
import { describe, expect, it } from 'vitest'
import {
  type ComfyNodeDef,
  validateComfyNodeDef
} from '@/schemas/nodeDefSchema'

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

## Mocking Composables with Reactive State

When mocking composables that return reactive refs, define the mock implementation inline in `vi.mock()`'s factory function. This ensures stable singleton instances across all test invocations.

### Rules

1. **Define mocks in the factory function** — Create `vi.fn()` and `ref()` instances directly inside `vi.mock()`, not in `beforeEach`
2. **Use singleton pattern** — The factory runs once; all calls to the composable return the same mock object
3. **Access mocks per-test** — Call the composable directly in each test to get the singleton instance rather than storing in a shared variable
4. **Wrap in `vi.mocked()` for type safety** — Use `vi.mocked(service.method).mockResolvedValue(...)` when configuring
5. **Rely on `vi.resetAllMocks()`** — Resets call counts without recreating instances; ref values may need manual reset if mutated

### Pattern

```typescript
// Example from: src/platform/updates/common/releaseStore.test.ts
import { ref } from 'vue'

vi.mock('@/path/to/composable', () => {
  const doSomething = vi.fn()
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  return {
    useMyComposable: () => ({
      doSomething,
      isLoading,
      error
    })
  }
})

describe('MyStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call the composable method', async () => {
    const service = useMyComposable()
    vi.mocked(service.doSomething).mockResolvedValue({ data: 'test' })

    await store.initialize()

    expect(service.doSomething).toHaveBeenCalledWith(expectedArgs)
  })

  it('should handle errors from the composable', async () => {
    const service = useMyComposable()
    vi.mocked(service.doSomething).mockResolvedValue(null)
    service.error.value = 'Something went wrong'

    await store.initialize()

    expect(store.error).toBe('Something went wrong')
  })
})
```

### Anti-patterns

```typescript
// ❌ Don't configure mock return values in beforeEach with shared variable
let mockService: { doSomething: Mock }
beforeEach(() => {
  mockService = { doSomething: vi.fn() }
  vi.mocked(useMyComposable).mockReturnValue(mockService)
})

// ❌ Don't auto-mock then override — reactive refs won't work correctly
vi.mock('@/path/to/composable')
vi.mocked(useMyComposable).mockReturnValue({ isLoading: ref(false) })
```

```

```
