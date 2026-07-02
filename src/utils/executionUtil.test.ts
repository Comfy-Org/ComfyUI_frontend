import { describe, expect, it, vi } from 'vitest'

import { LGraphEventMode } from '@/lib/litegraph/src/litegraph'

import { graphToPrompt } from './executionUtil'

const mocks = vi.hoisted(() => ({
  compressWidgetInputSlots: vi.fn()
}))

vi.mock('./litegraphUtil', () => ({
  compressWidgetInputSlots: mocks.compressWidgetInputSlots
}))

vi.mock('@/lib/litegraph/src/litegraph', () => ({
  LGraphEventMode: {
    NEVER: 1,
    BYPASS: 2
  },
  ExecutableNodeDTO: vi.fn(function (node: {
    id: number | string
    executionId?: number | string
    isVirtualNode?: boolean
    mode?: number
    widgets?: unknown[]
    inputs?: unknown[]
    resolveInput?: (index: number) => unknown
    comfyClass?: string
    title?: string
    dtoInnerNodes?: unknown[]
  }) {
    return {
      id: node.executionId ?? node.id,
      isVirtualNode: node.isVirtualNode ?? false,
      mode: node.mode ?? 0,
      widgets: node.widgets,
      inputs: node.inputs ?? [],
      resolveInput: node.resolveInput ?? (() => null),
      comfyClass: node.comfyClass,
      title: node.title,
      getInnerNodes: () => node.dtoInnerNodes ?? []
    }
  })
}))

function graphWith(
  nodes: unknown[],
  workflowExtra?: Record<string, unknown>,
  workflowNodes: Array<Record<string, unknown>> = [
    {
      inputs: [{ name: 'in', localized_name: 'Input' }],
      outputs: [{ name: 'out', localized_name: 'Output' }]
    }
  ]
) {
  return {
    computeExecutionOrder: vi.fn(() => nodes),
    serialize: vi.fn(() => ({
      nodes: workflowNodes,
      extra: workflowExtra
    }))
  }
}

describe('graphToPrompt', () => {
  it('serializes widget values, links, virtual setup, and workflow metadata', async () => {
    const virtualApply = vi.fn()
    const virtualInner = {
      id: 'virtual-inner',
      isVirtualNode: true,
      applyToGraph: virtualApply
    }
    const innerOutputNode = {
      id: 'inner-output',
      inputs: [],
      widgets: [],
      comfyClass: 'InnerClass',
      title: 'Inner'
    }
    const node = {
      id: 1,
      getInnerNodes: vi.fn(() => [virtualInner]),
      dtoInnerNodes: [innerOutputNode],
      inputs: [
        { name: 'missing' },
        { name: 'widget-array' },
        { name: 'link' },
        { name: 'removed' }
      ],
      widgets: [
        { name: '', value: 'ignored' },
        { name: 'skipped', value: 'ignored', options: { serialize: false } },
        {
          name: 'curve',
          type: 'curve',
          serializeValue: vi.fn(async () => [1, 2])
        },
        { name: 'array', value: [3, 4] },
        { name: 'plain', value: 'value' }
      ],
      resolveInput: vi.fn((index: number) => {
        if (index === 1) return { widgetInfo: { value: [5, 6] } }
        if (index === 2) return { origin_id: 'inner-output', origin_slot: '7' }
        if (index === 3) return { origin_id: 'removed-node', origin_slot: '1' }
        return null
      }),
      comfyClass: 'TestClass',
      title: 'Test'
    }
    const graph = graphWith([node])

    const { workflow, output } = await graphToPrompt(
      graph as unknown as Parameters<typeof graphToPrompt>[0],
      { sortNodes: true }
    )

    expect(virtualApply).toHaveBeenCalledTimes(1)
    expect(graph.serialize).toHaveBeenCalledWith({ sortNodes: true })
    expect(mocks.compressWidgetInputSlots).toHaveBeenCalledWith(workflow)
    expect(workflow.nodes[0].inputs?.[0]).toEqual({ name: 'in' })
    expect(workflow.nodes[0].outputs?.[0]).toEqual({ name: 'out' })
    expect(workflow.extra?.frontendVersion).toBeDefined()
    expect(output['1']).toEqual({
      inputs: {
        curve: { __type__: 'CURVE', __value__: [1, 2] },
        array: { __value__: [3, 4] },
        plain: 'value',
        'widget-array': { __value__: [5, 6] },
        link: ['inner-output', 7]
      },
      class_type: 'TestClass',
      _meta: { title: 'Test' }
    })
    expect(output['inner-output']).toEqual({
      inputs: {},
      class_type: 'InnerClass',
      _meta: { title: 'Inner' }
    })
  })

  it('skips muted and virtual executable nodes', async () => {
    const normalNode = {
      id: 'normal',
      inputs: [],
      comfyClass: 'Normal',
      title: 'Normal'
    }
    const mutedNode = {
      id: 'muted',
      mode: LGraphEventMode.NEVER,
      inputs: [],
      widgets: [{ name: 'value', value: 'ignored' }],
      comfyClass: 'Muted',
      title: 'Muted',
      dtoInnerNodes: [
        {
          id: 'muted-inner',
          inputs: [],
          comfyClass: 'MutedInner',
          title: 'MutedInner'
        }
      ]
    }
    const bypassedNode = {
      id: 'bypassed',
      mode: LGraphEventMode.BYPASS,
      inputs: [],
      comfyClass: 'Bypassed',
      title: 'Bypassed'
    }
    const virtualNode = {
      id: 'virtual',
      isVirtualNode: true,
      inputs: [],
      comfyClass: 'Virtual',
      title: 'Virtual'
    }
    const graph = graphWith(
      [normalNode, mutedNode, bypassedNode, virtualNode],
      {}
    )

    const { workflow, output } = await graphToPrompt(
      graph as unknown as Parameters<typeof graphToPrompt>[0]
    )

    expect(graph.serialize).toHaveBeenCalledWith({ sortNodes: false })
    expect(workflow.extra?.frontendVersion).toBeDefined()
    expect(Object.keys(output)).toEqual(['normal'])
  })

  it('preserves serialized workflow nodes without slot arrays', async () => {
    const node = {
      id: 1,
      inputs: [],
      comfyClass: 'NodeClass',
      title: 'Node'
    }
    const graph = graphWith([node], {}, [{ id: 1 }])

    const { workflow } = await graphToPrompt(
      graph as unknown as Parameters<typeof graphToPrompt>[0]
    )

    expect(workflow.nodes[0]).toEqual({ id: 1 })
  })
})
