import { describe, expect, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { subgraphTest } from './__fixtures__/subgraphFixtures'
import { verifyEventSequence } from './__fixtures__/subgraphHelpers'

describe('SubgraphEvents - Event Payload Verification', () => {
  subgraphTest(
    'dispatches input-added with correct payload',
    ({ eventCapture }) => {
      const { subgraph, capture } = eventCapture

      const input = subgraph.addInput('test_input', 'number')

      const addedEvents = capture.getEventsByType('input-added')
      expect(addedEvents).toHaveLength(1)

      expect(addedEvents[0].detail).toEqual({
        input: expect.objectContaining({
          name: 'test_input',
          type: 'number'
        })
      })

      expect(addedEvents[0].detail.input).toBe(input)
    }
  )

  subgraphTest(
    'dispatches output-added with correct payload',
    ({ eventCapture }) => {
      const { subgraph, capture } = eventCapture

      const output = subgraph.addOutput('test_output', 'string')

      const addedEvents = capture.getEventsByType('output-added')
      expect(addedEvents).toHaveLength(1)

      expect(addedEvents[0].detail).toEqual({
        output: expect.objectContaining({
          name: 'test_output',
          type: 'string'
        })
      })

      expect(addedEvents[0].detail.output).toBe(output)
    }
  )

  subgraphTest(
    'dispatches removing-input with correct payload',
    ({ eventCapture }) => {
      const { subgraph, capture } = eventCapture

      const input = subgraph.addInput('to_remove', 'boolean')

      capture.clear()

      subgraph.removeInput(input)

      const removingEvents = capture.getEventsByType('removing-input')
      expect(removingEvents).toHaveLength(1)

      expect(removingEvents[0].detail).toEqual({
        input: expect.objectContaining({
          name: 'to_remove',
          type: 'boolean'
        }),
        index: 0
      })

      expect(removingEvents[0].detail.input).toBe(input)
    }
  )

  subgraphTest(
    'dispatches removing-output with correct payload',
    ({ eventCapture }) => {
      const { subgraph, capture } = eventCapture

      const output = subgraph.addOutput('to_remove', 'number')

      capture.clear()

      subgraph.removeOutput(output)

      const removingEvents = capture.getEventsByType('removing-output')
      expect(removingEvents).toHaveLength(1)

      expect(removingEvents[0].detail).toEqual({
        output: expect.objectContaining({
          name: 'to_remove',
          type: 'number'
        }),
        index: 0
      })

      expect(removingEvents[0].detail.output).toBe(output)
    }
  )

  subgraphTest(
    'dispatches renaming-input with correct payload',
    ({ eventCapture }) => {
      const { subgraph, capture } = eventCapture

      const input = subgraph.addInput('old_name', 'string')

      capture.clear()

      subgraph.renameInput(input, 'new_name')

      const renamingEvents = capture.getEventsByType('renaming-input')
      expect(renamingEvents).toHaveLength(1)

      expect(renamingEvents[0].detail).toEqual({
        input: expect.objectContaining({
          type: 'string'
        }),
        index: 0,
        oldName: 'old_name',
        newName: 'new_name'
      })

      expect(renamingEvents[0].detail.input).toBe(input)

      // Verify the label was updated after the event (renameInput sets label, not name)
      expect(input.label).toBe('new_name')
      expect(input.displayName).toBe('new_name')
      expect(input.name).toBe('old_name')
    }
  )

  subgraphTest(
    'dispatches renaming-output with correct payload',
    ({ eventCapture }) => {
      const { subgraph, capture } = eventCapture

      const output = subgraph.addOutput('old_name', 'number')

      capture.clear()

      subgraph.renameOutput(output, 'new_name')

      const renamingEvents = capture.getEventsByType('renaming-output')
      expect(renamingEvents).toHaveLength(1)

      expect(renamingEvents[0].detail).toEqual({
        output: expect.objectContaining({
          name: 'old_name', // Should still have the old name when event is dispatched
          type: 'number'
        }),
        index: 0,
        oldName: 'old_name',
        newName: 'new_name'
      })

      expect(renamingEvents[0].detail.output).toBe(output)

      // Verify the label was updated after the event
      expect(output.label).toBe('new_name')
      expect(output.displayName).toBe('new_name')
      expect(output.name).toBe('old_name')
    }
  )

  subgraphTest(
    'dispatches adding-input with correct payload',
    ({ eventCapture }) => {
      const { subgraph, capture } = eventCapture

      subgraph.addInput('test_input', 'number')

      const addingEvents = capture.getEventsByType('adding-input')
      expect(addingEvents).toHaveLength(1)

      expect(addingEvents[0].detail).toEqual({
        name: 'test_input',
        type: 'number'
      })
    }
  )

  subgraphTest(
    'dispatches adding-output with correct payload',
    ({ eventCapture }) => {
      const { subgraph, capture } = eventCapture

      subgraph.addOutput('test_output', 'string')

      const addingEvents = capture.getEventsByType('adding-output')
      expect(addingEvents).toHaveLength(1)

      expect(addingEvents[0].detail).toEqual({
        name: 'test_output',
        type: 'string'
      })
    }
  )
})

describe('SubgraphEvents - Event Handler Isolation', () => {
  subgraphTest(
    'surfaces handler errors to caller and stops propagation',
    ({ emptySubgraph }) => {
      const handler1 = vi.fn(() => {
        throw new Error('Handler 1 error')
      })
      const handler2 = vi.fn()
      const handler3 = vi.fn()

      emptySubgraph.events.addEventListener('input-added', handler1)
      emptySubgraph.events.addEventListener('input-added', handler2)
      emptySubgraph.events.addEventListener('input-added', handler3)

      // Current runtime behavior: listener exceptions bubble out of dispatch.
      expect(() => {
        emptySubgraph.addInput('test', 'number')
      }).toThrowError('Handler 1 error')

      // Once the first listener throws, later listeners are not invoked.
      expect(handler1).toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
      expect(handler3).not.toHaveBeenCalled()

      // Verify the throwing handler actually received the event
      expect(handler1).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'input-added'
        })
      )
    }
  )

  subgraphTest('maintains handler execution order', ({ emptySubgraph }) => {
    const executionOrder: number[] = []

    const handler1 = vi.fn(() => executionOrder.push(1))
    const handler2 = vi.fn(() => executionOrder.push(2))
    const handler3 = vi.fn(() => executionOrder.push(3))

    emptySubgraph.events.addEventListener('input-added', handler1)
    emptySubgraph.events.addEventListener('input-added', handler2)
    emptySubgraph.events.addEventListener('input-added', handler3)

    emptySubgraph.addInput('test', 'number')

    expect(executionOrder).toEqual([1, 2, 3])
  })

  subgraphTest(
    'prevents handler accumulation with proper cleanup',
    ({ emptySubgraph }) => {
      const handler = vi.fn()

      for (let i = 0; i < 5; i++) {
        emptySubgraph.events.addEventListener('input-added', handler)
        emptySubgraph.events.removeEventListener('input-added', handler)
      }

      emptySubgraph.events.addEventListener('input-added', handler)

      emptySubgraph.addInput('test', 'number')

      expect(handler).toHaveBeenCalledTimes(1)
    }
  )

  subgraphTest(
    'supports AbortController cleanup patterns',
    ({ emptySubgraph }) => {
      const abortController = new AbortController()
      const { signal } = abortController

      const handler = vi.fn()

      emptySubgraph.events.addEventListener('input-added', handler, { signal })

      emptySubgraph.addInput('test1', 'number')
      expect(handler).toHaveBeenCalledTimes(1)

      abortController.abort()

      emptySubgraph.addInput('test2', 'number')
      expect(handler).toHaveBeenCalledTimes(1)
    }
  )
})

describe('SubgraphEvents - Event Sequence Testing', () => {
  subgraphTest(
    'maintains correct event sequence for inputs',
    ({ eventCapture }) => {
      const { subgraph, capture } = eventCapture

      subgraph.addInput('input1', 'number')

      verifyEventSequence(capture.events, ['adding-input', 'input-added'])
    }
  )

  subgraphTest(
    'maintains correct event sequence for outputs',
    ({ eventCapture }) => {
      const { subgraph, capture } = eventCapture

      subgraph.addOutput('output1', 'string')

      verifyEventSequence(capture.events, ['adding-output', 'output-added'])
    }
  )

  subgraphTest(
    'maintains correct event sequence for rapid operations',
    ({ eventCapture }) => {
      const { subgraph, capture } = eventCapture

      subgraph.addInput('input1', 'number')
      subgraph.addInput('input2', 'string')
      subgraph.addOutput('output1', 'boolean')
      subgraph.addOutput('output2', 'number')

      verifyEventSequence(capture.events, [
        'adding-input',
        'input-added',
        'adding-input',
        'input-added',
        'adding-output',
        'output-added',
        'adding-output',
        'output-added'
      ])
    }
  )

  subgraphTest('fires all listeners synchronously', ({ eventCapture }) => {
    const { subgraph, capture } = eventCapture

    const handler1 = vi.fn(() => {
      return new Promise((resolve) => setTimeout(resolve, 1))
    })

    const handler2 = vi.fn()
    const handler3 = vi.fn()

    subgraph.events.addEventListener('input-added', handler1)
    subgraph.events.addEventListener('input-added', handler2)
    subgraph.events.addEventListener('input-added', handler3)

    subgraph.addInput('test', 'number')

    expect(handler1).toHaveBeenCalled()
    expect(handler2).toHaveBeenCalled()
    expect(handler3).toHaveBeenCalled()

    const addedEvents = capture.getEventsByType('input-added')
    expect(addedEvents).toHaveLength(1)
  })

  subgraphTest(
    'validates event timestamps are properly ordered',
    ({ eventCapture }) => {
      const { subgraph, capture } = eventCapture

      subgraph.addInput('input1', 'number')
      subgraph.addInput('input2', 'string')
      subgraph.addOutput('output1', 'boolean')

      for (let i = 1; i < capture.events.length; i++) {
        expect(capture.events[i].timestamp).toBeGreaterThanOrEqual(
          capture.events[i - 1].timestamp
        )
      }
    }
  )
})

describe('SubgraphEvents - Event Cancellation', () => {
  subgraphTest(
    'supports preventDefault() for cancellable events',
    ({ emptySubgraph }) => {
      const preventHandler = vi.fn((event: Event) => {
        event.preventDefault()
      })

      emptySubgraph.events.addEventListener('removing-input', preventHandler)

      const input = emptySubgraph.addInput('test', 'number')

      emptySubgraph.removeInput(input)

      expect(emptySubgraph.inputs).toContain(input)
      expect(preventHandler).toHaveBeenCalled()
    }
  )

  subgraphTest(
    'supports preventDefault() for output removal',
    ({ emptySubgraph }) => {
      const preventHandler = vi.fn((event: Event) => {
        event.preventDefault()
      })

      emptySubgraph.events.addEventListener('removing-output', preventHandler)

      const output = emptySubgraph.addOutput('test', 'number')

      emptySubgraph.removeOutput(output)

      expect(emptySubgraph.outputs).toContain(output)
      expect(preventHandler).toHaveBeenCalled()
    }
  )

  subgraphTest('allows removal when not prevented', ({ emptySubgraph }) => {
    const allowHandler = vi.fn()

    emptySubgraph.events.addEventListener('removing-input', allowHandler)

    const input = emptySubgraph.addInput('test', 'number')

    emptySubgraph.removeInput(input)

    expect(emptySubgraph.inputs).not.toContain(input)
    expect(emptySubgraph.inputs).toHaveLength(0)
    expect(allowHandler).toHaveBeenCalled()
  })

  subgraphTest('veto preserves input connections', ({ emptySubgraph }) => {
    const input = emptySubgraph.addInput('test', 'number')

    const node = new LGraphNode('Interior')
    node.addInput('in', 'number')
    emptySubgraph.add(node)

    input.connect(node.inputs[0], node)
    expect(input.linkIds).not.toHaveLength(0)

    emptySubgraph.events.addEventListener('removing-input', (event) => {
      event.preventDefault()
    })

    emptySubgraph.removeInput(input)

    expect(emptySubgraph.inputs).toContain(input)
    expect(input.linkIds).not.toHaveLength(0)
  })

  subgraphTest('veto preserves output connections', ({ emptySubgraph }) => {
    const output = emptySubgraph.addOutput('test', 'number')

    const node = new LGraphNode('Interior')
    node.addOutput('out', 'number')
    emptySubgraph.add(node)

    output.connect(node.outputs[0], node)
    expect(output.linkIds).not.toHaveLength(0)

    emptySubgraph.events.addEventListener('removing-output', (event) => {
      event.preventDefault()
    })

    emptySubgraph.removeOutput(output)

    expect(emptySubgraph.outputs).toContain(output)
    expect(output.linkIds).not.toHaveLength(0)
  })

  subgraphTest(
    'rename input cancellation does not prevent rename',
    ({ emptySubgraph }) => {
      const input = emptySubgraph.addInput('original', 'number')

      const preventHandler = vi.fn((event: Event) => {
        event.preventDefault()
      })
      emptySubgraph.events.addEventListener('renaming-input', preventHandler)

      emptySubgraph.renameInput(input, 'new_name')

      expect(input.label).toBe('new_name')
      expect(preventHandler).toHaveBeenCalled()
    }
  )

  subgraphTest(
    'rename output cancellation does not prevent rename',
    ({ emptySubgraph }) => {
      const output = emptySubgraph.addOutput('original', 'number')

      const preventHandler = vi.fn((event: Event) => {
        event.preventDefault()
      })
      emptySubgraph.events.addEventListener('renaming-output', preventHandler)

      emptySubgraph.renameOutput(output, 'new_name')

      expect(output.label).toBe('new_name')
      expect(preventHandler).toHaveBeenCalled()
    }
  )
})
