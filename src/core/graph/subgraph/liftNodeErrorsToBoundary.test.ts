import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
import { nodeError, validationError } from '@/utils/__tests__/nodeErrorHelpers'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createBoundaryLinkedSubgraph,
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { toNodeId } from '@/types/nodeId'

import { liftNodeErrorsToBoundary } from './liftNodeErrorsToBoundary'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
})

describe('liftNodeErrorsToBoundary', () => {
  it('lifts a boundary-linked slot error to the host', () => {
    const { host, rootGraph } = createBoundaryLinkedSubgraph()
    const errors = {
      '12:5': nodeError([
        validationError('required_input_missing', 'seed_input')
      ])
    }

    const result = liftNodeErrorsToBoundary(rootGraph, errors)

    expect(result).toEqual({
      '12': {
        class_type: host.title,
        dependent_outputs: [],
        errors: [
          expect.objectContaining({
            type: 'required_input_missing',
            extra_info: expect.objectContaining({
              input_name: 'seed',
              source_execution_id: '12:5',
              source_input_name: 'seed_input'
            })
          })
        ]
      }
    })
  })

  it('lifts a promoted-widget value error to the host input', () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })
    const host = createTestSubgraphNode(subgraph, { id: 12 })
    rootGraph.add(host)

    const interior = new LGraphNode('CheckpointLoaderSimple')
    interior.id = toNodeId(5)
    const input = interior.addInput('ckpt_name', 'COMBO')
    const widget = interior.addWidget('combo', 'ckpt_name', '', () => {}, {
      values: ['present.safetensors']
    })
    input.widget = { name: widget.name }
    subgraph.add(interior)

    expect(promoteValueWidgetViaSubgraphInput(host, interior, widget).ok).toBe(
      true
    )

    const result = liftNodeErrorsToBoundary(rootGraph, {
      '12:5': nodeError([
        validationError('value_not_in_list', 'ckpt_name', {
          received_value: 'missing.safetensors',
          input_config: ['COMBO', { values: ['present.safetensors'] }]
        })
      ])
    })

    expect(result['12'].errors[0].extra_info).toMatchObject({
      input_name: 'ckpt_name',
      source_execution_id: '12:5',
      source_input_name: 'ckpt_name',
      received_value: 'missing.safetensors',
      input_config: ['COMBO', { values: ['present.safetensors'] }]
    })
  })

  it('recurses through nested boundary-linked hosts', () => {
    const rootGraph = createTestRootGraph()
    const outerSubgraph = createTestSubgraph({
      rootGraph,
      inputs: [{ name: 'seed', type: '*' }]
    })
    const outerHost = createTestSubgraphNode(outerSubgraph, { id: 1 })
    outerHost.title = 'Outer Host'
    rootGraph.add(outerHost)

    const middleSubgraph = createTestSubgraph({
      rootGraph,
      inputs: [{ name: 'seed', type: '*' }]
    })
    const middleHost = createTestSubgraphNode(middleSubgraph, {
      id: 2,
      parentGraph: outerSubgraph
    })
    outerSubgraph.add(middleHost)
    outerSubgraph.inputNode.slots[0].connect(middleHost.inputs[0], middleHost)

    const leaf = new LGraphNode('LeafNode')
    leaf.id = toNodeId(3)
    const leafInput = leaf.addInput('seed_input', '*')
    middleSubgraph.add(leaf)
    middleSubgraph.inputNode.slots[0].connect(leafInput, leaf)

    const result = liftNodeErrorsToBoundary(rootGraph, {
      '1:2:3': nodeError([
        validationError('required_input_missing', 'seed_input')
      ])
    })

    expect(Object.keys(result)).toEqual(['1'])
    expect(result['1'].class_type).toBe(outerHost.title)
    expect(result['1'].errors[0].extra_info).toMatchObject({
      input_name: 'seed',
      source_execution_id: '1:2:3',
      source_input_name: 'seed_input'
    })
  })

  it('keeps errors on ordinary interior data-flow links', () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({
      rootGraph,
      inputs: [{ name: 'seed', type: '*' }]
    })
    const host = createTestSubgraphNode(subgraph, { id: 12 })
    rootGraph.add(host)

    const source = new LGraphNode('SourceNode')
    source.id = toNodeId(4)
    source.addOutput('seed', '*')
    subgraph.add(source)

    const target = new LGraphNode('TargetNode')
    target.id = toNodeId(5)
    target.addInput('seed_input', '*')
    subgraph.add(target)
    source.connect(0, target, 0)

    const errors = {
      '12:5': nodeError([
        validationError('required_input_missing', 'seed_input')
      ])
    }

    expect(liftNodeErrorsToBoundary(rootGraph, errors)).toEqual(errors)
  })

  it('keeps errors without a liftable subject on the interior node', () => {
    const { rootGraph } = createBoundaryLinkedSubgraph()
    const errors = {
      '12:5': nodeError([
        validationError('required_input_missing'),
        validationError('exception_during_validation', 'seed_input'),
        validationError('dependency_cycle', 'seed_input'),
        validationError(
          'custom_validation_failed',
          'seed_input',
          { received_value: 'image.png' },
          'Invalid image file'
        )
      ])
    }

    expect(liftNodeErrorsToBoundary(rootGraph, errors)).toEqual(errors)
  })

  it('keeps unknown typed validation errors on the interior node', () => {
    const { rootGraph } = createBoundaryLinkedSubgraph()
    const errors = {
      '12:5': nodeError([
        validationError('future_backend_validation_type', 'seed_input')
      ])
    }

    expect(liftNodeErrorsToBoundary(rootGraph, errors)).toEqual(errors)
  })

  it('splits liftable and non-liftable errors from the same node entry', () => {
    const { rootGraph } = createBoundaryLinkedSubgraph()

    const result = liftNodeErrorsToBoundary(rootGraph, {
      '12:5': nodeError([
        validationError('required_input_missing', 'seed_input'),
        validationError('exception_during_validation', 'seed_input')
      ])
    })

    expect(result['12'].errors).toHaveLength(1)
    expect(result['12'].errors[0].type).toBe('required_input_missing')
    expect(result['12:5'].errors).toHaveLength(1)
    expect(result['12:5'].errors[0].type).toBe('exception_during_validation')
  })

  it('merges a lifted error into an existing host entry', () => {
    const { rootGraph } = createBoundaryLinkedSubgraph()
    const errors = {
      '12': {
        class_type: 'ExistingHostClass',
        dependent_outputs: ['existing-output'],
        errors: [validationError('value_smaller_than_min', 'other')]
      },
      '12:5': nodeError([
        validationError('required_input_missing', 'seed_input')
      ])
    }

    const result = liftNodeErrorsToBoundary(rootGraph, errors)

    expect(result['12']).toMatchObject({
      class_type: 'ExistingHostClass',
      dependent_outputs: ['existing-output']
    })
    expect(result['12'].errors.map((error) => error.type)).toEqual([
      'value_smaller_than_min',
      'required_input_missing'
    ])
  })

  it('keeps own errors before lifted errors for nested host keys', () => {
    const rootGraph = createTestRootGraph()
    const outerSubgraph = createTestSubgraph({ rootGraph })
    const outerHost = createTestSubgraphNode(outerSubgraph, { id: 1 })
    rootGraph.add(outerHost)

    const middleSubgraph = createTestSubgraph({
      rootGraph,
      inputs: [{ name: 'seed', type: '*' }]
    })
    const middleHost = createTestSubgraphNode(middleSubgraph, {
      id: 2,
      parentGraph: outerSubgraph
    })
    outerSubgraph.add(middleHost)

    const leaf = new LGraphNode('LeafNode')
    leaf.id = toNodeId(3)
    const leafInput = leaf.addInput('seed_input', '*')
    middleSubgraph.add(leaf)
    middleSubgraph.inputNode.slots[0].connect(leafInput, leaf)

    const result = liftNodeErrorsToBoundary(rootGraph, {
      '1:2:3': nodeError([
        validationError('required_input_missing', 'seed_input')
      ]),
      '1:2': nodeError([validationError('value_smaller_than_min', 'seed')])
    })

    expect(result['1:2'].errors.map((error) => error.type)).toEqual([
      'value_smaller_than_min',
      'required_input_missing'
    ])
  })

  it('preserves empty error entries unchanged', () => {
    const rootGraph = createTestRootGraph()
    const errors = {
      '12': nodeError([], 'ExtraRootNode')
    }

    expect(liftNodeErrorsToBoundary(rootGraph, errors)).toEqual(errors)
  })

  it('fails open without mutating the input record', () => {
    const rootGraph = createTestRootGraph()
    const subgraph = createTestSubgraph({ rootGraph })
    const host = createTestSubgraphNode(subgraph, { id: 12 })
    rootGraph.add(host)
    const interior = new LGraphNode('InteriorNode')
    interior.id = toNodeId(5)
    interior.addInput('unlinked', '*')
    subgraph.add(interior)

    const errors = {
      '99:5': nodeError([validationError('required_input_missing', 'x')]),
      '12:5': nodeError([
        validationError('required_input_missing', 'missing'),
        validationError('value_not_in_list', 'unlinked')
      ])
    }
    const original = structuredClone(errors)

    const result = liftNodeErrorsToBoundary(rootGraph, errors)

    expect(result).toEqual(original)
    expect(errors).toEqual(original)
    expect(result).not.toBe(errors)
  })
})
