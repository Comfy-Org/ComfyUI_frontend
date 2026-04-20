/**
 * Core Subgraph Tests
 *
 * This file implements fundamental tests for the Subgraph class that establish
 * patterns for the rest of the testing team. These tests cover construction
 * and basic I/O management.
 */
import { createTestingPinia } from '@pinia/testing'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { createUuidv4, Subgraph } from '@/lib/litegraph/src/litegraph'
import { subgraphTest } from './__fixtures__/subgraphFixtures'
import {
  assertSubgraphStructure,
  createTestSubgraph,
  createTestSubgraphData,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  resetSubgraphFixtureState()
})

describe('Subgraph Construction', () => {
  it('should create a subgraph with minimal data', () => {
    const subgraph = createTestSubgraph()

    assertSubgraphStructure(subgraph, {
      inputCount: 0,
      outputCount: 0,
      nodeCount: 0,
      name: 'Test Subgraph'
    })

    expect(subgraph.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    )
    expect(subgraph.inputNode).toBeDefined()
    expect(subgraph.outputNode).toBeDefined()
    expect(subgraph.inputNode.id).toBe(-10)
    expect(subgraph.outputNode.id).toBe(-20)
  })

  it('should require a root graph', () => {
    const subgraphData = createTestSubgraphData()
    const createWithoutRoot = () =>
      new Subgraph(fromAny<LGraph, unknown>(null), subgraphData)

    expect(createWithoutRoot).toThrow('Root graph is required')
  })

  it('should accept custom name and ID', () => {
    const customId = createUuidv4()
    const customName = 'My Custom Subgraph'

    const subgraph = createTestSubgraph({
      id: customId,
      name: customName
    })

    expect(subgraph.id).toBe(customId)
    expect(subgraph.name).toBe(customName)
  })
})

describe('Subgraph Input/Output Management', () => {
  subgraphTest('should add a single input', ({ emptySubgraph }) => {
    const input = emptySubgraph.addInput('test_input', 'number')

    expect(emptySubgraph.inputs).toHaveLength(1)
    expect(input.name).toBe('test_input')
    expect(input.type).toBe('number')
    expect(emptySubgraph.inputs.indexOf(input)).toBe(0)
  })

  subgraphTest('should add a single output', ({ emptySubgraph }) => {
    const output = emptySubgraph.addOutput('test_output', 'string')

    expect(emptySubgraph.outputs).toHaveLength(1)
    expect(output.name).toBe('test_output')
    expect(output.type).toBe('string')
    expect(emptySubgraph.outputs.indexOf(output)).toBe(0)
  })

  subgraphTest(
    'should maintain correct indices when adding multiple inputs',
    ({ emptySubgraph }) => {
      const input1 = emptySubgraph.addInput('input_1', 'number')
      const input2 = emptySubgraph.addInput('input_2', 'string')
      const input3 = emptySubgraph.addInput('input_3', 'boolean')

      expect(emptySubgraph.inputs.indexOf(input1)).toBe(0)
      expect(emptySubgraph.inputs.indexOf(input2)).toBe(1)
      expect(emptySubgraph.inputs.indexOf(input3)).toBe(2)
      expect(emptySubgraph.inputs).toHaveLength(3)
    }
  )

  subgraphTest(
    'should maintain correct indices when adding multiple outputs',
    ({ emptySubgraph }) => {
      const output1 = emptySubgraph.addOutput('output_1', 'number')
      const output2 = emptySubgraph.addOutput('output_2', 'string')
      const output3 = emptySubgraph.addOutput('output_3', 'boolean')

      expect(emptySubgraph.outputs.indexOf(output1)).toBe(0)
      expect(emptySubgraph.outputs.indexOf(output2)).toBe(1)
      expect(emptySubgraph.outputs.indexOf(output3)).toBe(2)
      expect(emptySubgraph.outputs).toHaveLength(3)
    }
  )

  subgraphTest('should remove inputs correctly', ({ simpleSubgraph }) => {
    // Add a second input first
    simpleSubgraph.addInput('second_input', 'string')
    expect(simpleSubgraph.inputs).toHaveLength(2)

    // Remove the first input
    const firstInput = simpleSubgraph.inputs[0]
    simpleSubgraph.removeInput(firstInput)

    expect(simpleSubgraph.inputs).toHaveLength(1)
    expect(simpleSubgraph.inputs[0].name).toBe('second_input')
    // Verify it's at index 0 in the array
    expect(simpleSubgraph.inputs.indexOf(simpleSubgraph.inputs[0])).toBe(0)
  })

  subgraphTest('should remove outputs correctly', ({ simpleSubgraph }) => {
    // Add a second output first
    simpleSubgraph.addOutput('second_output', 'string')
    expect(simpleSubgraph.outputs).toHaveLength(2)

    // Remove the first output
    const firstOutput = simpleSubgraph.outputs[0]
    simpleSubgraph.removeOutput(firstOutput)

    expect(simpleSubgraph.outputs).toHaveLength(1)
    expect(simpleSubgraph.outputs[0].name).toBe('second_output')
    // Verify it's at index 0 in the array
    expect(simpleSubgraph.outputs.indexOf(simpleSubgraph.outputs[0])).toBe(0)
  })
})
