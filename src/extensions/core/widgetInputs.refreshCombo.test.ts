import { fromPartial } from '@total-typescript/shoehorn'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph, LLink } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { ComfyNodeDef, InputSpec } from '@/schemas/nodeDefSchema'
import { GET_CONFIG } from '@/services/litegraphService'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import type { LinkId } from '@/types/linkId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import {
  createMockLGraph,
  createMockLGraphNode,
  createMockLLink,
  createMockLinks
} from '@/utils/__tests__/litegraphTestUtils'
import { createUuidv4 } from '@/utils/uuid'

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: { graph_mouse: [0, 0] },
    configuringGraph: false,
    registerExtension: vi.fn()
  }
}))

import { PrimitiveNode } from './widgetInputs'

const TARGET_NODE_TYPE = 'KSampler'
const TARGET_INPUT_NAME = 'sampler_name'
const ORIGINAL_OPTIONS = ['euler', 'euler_ancestral', 'heun']
const FRESH_OPTIONS = ['euler', 'euler_ancestral', 'heun', 'lcm']

function mockGetLink(links: LGraph['links']): LGraph['getLink'] {
  function getLink(id: null | undefined): undefined
  function getLink(id: LinkId | null | undefined): LLink | undefined
  function getLink(id: LinkId | null | undefined): LLink | undefined {
    return id == null ? undefined : links.get(id)
  }
  return getLink
}

function registerLink(graph: LGraph, node: PrimitiveNode, linkId: number) {
  const link = graph.links.get(toLinkId(linkId))
  if (!link) throw new Error(`Expected link ${linkId}`)

  const scope = graphScopeOf(graph)
  const registered = useLinkStore().registerLink(scope, {
    id: link.id,
    graphId: scope.owningGraphId,
    originNodeId: node.id,
    originSlot: 0,
    targetNodeId: link.target_id,
    targetSlot: link.target_slot,
    type: link.type
  })
  if (!registered) throw new Error(`Failed to register link ${linkId}`)
  if (!useLinkStore().isOutputSlotConnected(scope, node.id, 0)) {
    throw new Error(`Failed to index link ${linkId}`)
  }
}

function setupComboNode(inputWidgetName: string | null = TARGET_INPUT_NAME) {
  const node = new PrimitiveNode('Primitive')
  node.id = toNodeId(1)
  const targetNode = createMockLGraphNode({
    id: toNodeId(7),
    type: TARGET_NODE_TYPE,
    inputs: [
      {
        name: TARGET_INPUT_NAME,
        type: 'COMBO',
        link: toLinkId(1),
        widget: inputWidgetName ? { name: inputWidgetName } : undefined
      }
    ]
  })
  const link = createMockLLink({
    id: toLinkId(1),
    target_id: targetNode.id,
    target_slot: 0
  })
  const widget = fromPartial<IBaseWidget>({
    type: 'combo',
    name: 'value',
    value: 'euler',
    options: { values: ORIGINAL_OPTIONS },
    callback: vi.fn()
  })

  const links = createMockLinks([link])
  const graph = createMockLGraph({
    id: createUuidv4(),
    links,
    getLink: mockGetLink(links),
    getNodeById: vi.fn(() => targetNode)
  })
  node.graph = graph
  registerLink(graph, node, 1)
  node.outputs[0].widget = {
    name: TARGET_INPUT_NAME,
    [GET_CONFIG]: () => [ORIGINAL_OPTIONS, {}]
  }
  node.widgets = [widget]

  return { graph, node, targetNode, widget }
}

function defsWithSpec(
  inputSpec: InputSpec,
  nodeType = TARGET_NODE_TYPE
): Record<string, ComfyNodeDef> {
  return {
    [nodeType]: fromPartial<ComfyNodeDef>({
      input: { required: { [TARGET_INPUT_NAME]: inputSpec } }
    })
  }
}

describe('PrimitiveNode.refreshComboInNode', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it.each<[string, InputSpec]>([
    ['V1', [FRESH_OPTIONS, {}]],
    ['V2', ['COMBO', { options: FRESH_OPTIONS }]]
  ])('updates options from fresh %s definitions', (_, inputSpec) => {
    const { node, widget } = setupComboNode()

    node.refreshComboInNode(defsWithSpec(inputSpec))

    expect(widget.options.values).toEqual(FRESH_OPTIONS)
    expect(widget.value).toBe('euler')
    expect(widget.callback).not.toHaveBeenCalled()
  })

  it('uses only options shared by every connected input', () => {
    const { graph, node, targetNode, widget } = setupComboNode()
    const otherTarget = createMockLGraphNode({
      id: toNodeId(8),
      type: 'OtherSampler',
      inputs: [
        {
          name: TARGET_INPUT_NAME,
          type: 'COMBO',
          link: toLinkId(2),
          widget: { name: TARGET_INPUT_NAME }
        }
      ]
    })
    const links = [
      createMockLLink({
        id: toLinkId(1),
        target_id: targetNode.id,
        target_slot: 0
      }),
      createMockLLink({
        id: toLinkId(2),
        target_id: otherTarget.id,
        target_slot: 0
      })
    ]
    graph.links = createMockLinks(links)
    graph.getLink = mockGetLink(graph.links)
    graph.getNodeById = vi.fn((id) =>
      id === targetNode.id ? targetNode : otherTarget
    )
    registerLink(graph, node, 2)

    node.refreshComboInNode({
      ...defsWithSpec([['euler', 'heun'], {}]),
      ...defsWithSpec([['heun', 'lcm'], {}], 'OtherSampler')
    })

    expect(widget.options.values).toEqual(['heun'])
    expect(widget.value).toBe('heun')
    expect(widget.callback).toHaveBeenCalledWith('heun')
  })

  it('falls back to the slot config when fresh definitions omit the target', () => {
    const { node, widget } = setupComboNode()
    widget.options.values = []

    node.refreshComboInNode({})

    expect(widget.options.values).toEqual(ORIGINAL_OPTIONS)
  })

  it('preserves existing options when neither source resolves a config', () => {
    const { node, widget } = setupComboNode()
    node.outputs[0].widget = {
      name: TARGET_INPUT_NAME,
      [GET_CONFIG]: () => undefined
    }

    node.refreshComboInNode({})

    expect(widget.options.values).toEqual(ORIGINAL_OPTIONS)
    expect(widget.value).toBe('euler')
  })

  it('propagates an empty option list from fresh definitions', () => {
    const { node, widget } = setupComboNode()

    node.refreshComboInNode(defsWithSpec([[], {}]))

    expect(widget.options.values).toEqual([])
    expect(widget.value).toBeUndefined()
  })

  it('uses the input name when the input has no widget locator', () => {
    const { node, widget } = setupComboNode(null)
    widget.options.values = []

    node.refreshComboInNode(defsWithSpec([FRESH_OPTIONS, {}]))

    expect(widget.options.values).toEqual(FRESH_OPTIONS)
  })
})
