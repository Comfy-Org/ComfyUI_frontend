import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { LGraphBadge } from '@/lib/litegraph/src/litegraph'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import {
  trackNodePrice,
  usePartitionedBadges
} from '@/renderer/extensions/vueNodes/composables/usePartitionedBadges'
import { toNodeId } from '@/types/nodeId'
import { NodeBadgeMode } from '@/types/nodeSource'

const { settings, nodeDefs, pricing, getNodeRevisionRefMock, getWidgetMock } =
  vi.hoisted(() => ({
    settings: {} as Record<string, unknown>,
    nodeDefs: {} as Record<string, unknown>,
    pricing: {
      dynamic: false,
      widgets: [] as string[],
      inputs: [] as string[],
      groups: [] as string[]
    },
    getNodeRevisionRefMock: vi.fn(() => ({ value: 0 })),
    getWidgetMock: vi.fn(() => ({ value: 'widget-value' }))
  }))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: { graph: { getNodeById: () => null, rootGraph: { id: 'g1' } } }
  }
}))

vi.mock('@/composables/node/useNodePricing', () => ({
  useNodePricing: () => ({
    getRelevantWidgetNames: () => pricing.widgets,
    hasDynamicPricing: () => pricing.dynamic,
    getInputGroupPrefixes: () => pricing.groups,
    getInputNames: () => pricing.inputs,
    getNodeRevisionRef: getNodeRevisionRefMock
  })
}))

vi.mock('@/composables/node/usePriceBadge', () => ({
  usePriceBadge: () => ({
    isCreditsBadge: (b: { text?: string }) => b.text?.startsWith('$') ?? false
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: (key: string) => settings[key] })
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({ nodeDefsByName: nodeDefs })
}))

vi.mock('@/stores/widgetValueStore', () => ({
  useWidgetValueStore: () => ({ getWidget: getWidgetMock })
}))

function nodeData(overrides: Partial<VueNodeData> = {}): VueNodeData {
  return {
    executing: false,
    id: toNodeId(1),
    mode: 0,
    selected: false,
    title: 'Test node',
    type: 'TestNode',
    apiNode: false,
    badges: [],
    inputs: [],
    ...overrides
  } satisfies VueNodeData
}

function inputSlot(
  name: string,
  readLink: () => number | null
): INodeInputSlot {
  return {
    name,
    type: '*',
    boundingRect: [0, 0, 0, 0],
    get link() {
      return readLink()
    },
    set link(_value: number | null) {}
  } as INodeInputSlot
}

function badge(text: string): LGraphBadge {
  return new LGraphBadge({ text })
}

beforeEach(() => {
  settings['Comfy.NodeBadge.NodeSourceBadgeMode'] = NodeBadgeMode.None
  settings['Comfy.NodeBadge.NodeLifeCycleBadgeMode'] = NodeBadgeMode.None
  settings['Comfy.NodeBadge.NodeIdBadgeMode'] = NodeBadgeMode.None
  for (const k of Object.keys(nodeDefs)) delete nodeDefs[k]
  nodeDefs['TestNode'] = { isCoreNode: false }
  pricing.dynamic = false
  pricing.widgets = []
  pricing.inputs = []
  pricing.groups = []
  getNodeRevisionRefMock.mockClear()
  getWidgetMock.mockClear()
})

describe('usePartitionedBadges', () => {
  it('emits no core badges when every badge mode is None', () => {
    const result = usePartitionedBadges(nodeData()).value
    expect(result.core).toEqual([])
  })

  it('tracks dynamic-pricing widget and input dependencies for an api node', () => {
    pricing.dynamic = true
    pricing.widgets = ['seed']
    pricing.inputs = ['model']
    pricing.groups = ['lora']
    let modelReads = 0
    let groupReads = 0
    let unrelatedReads = 0
    const result = usePartitionedBadges(
      nodeData({
        apiNode: true,
        inputs: [
          inputSlot('model', () => {
            modelReads += 1
            return 1
          }),
          inputSlot('lora.0', () => {
            groupReads += 1
            return 2
          }),
          inputSlot('unrelated', () => {
            unrelatedReads += 1
            return null
          })
        ]
      })
    ).value

    expect(getNodeRevisionRefMock).toHaveBeenCalledWith(toNodeId(1))
    expect(getWidgetMock).toHaveBeenCalledTimes(1)
    expect(modelReads).toBe(1)
    expect(groupReads).toBe(1)
    expect(unrelatedReads).toBe(0)
    expect(result.core).toEqual([])
    expect(result.extension).toEqual([])
  })

  it('adds an id badge when the id mode is enabled', () => {
    settings['Comfy.NodeBadge.NodeIdBadgeMode'] = NodeBadgeMode.ShowAll
    const result = usePartitionedBadges(nodeData({ id: toNodeId(7) })).value
    expect(result.core).toContainEqual({ text: '#7' })
  })

  it('adds a lifecycle badge, trimmed of brackets', () => {
    settings['Comfy.NodeBadge.NodeLifeCycleBadgeMode'] = NodeBadgeMode.ShowAll
    nodeDefs['TestNode'] = {
      isCoreNode: false,
      nodeLifeCycleBadgeText: '[BETA]'
    }
    const result = usePartitionedBadges(nodeData()).value
    expect(result.core).toContainEqual({ text: 'BETA' })
  })

  it('adds a source badge for non-core nodes when source mode is on', () => {
    settings['Comfy.NodeBadge.NodeSourceBadgeMode'] = NodeBadgeMode.ShowAll
    nodeDefs['TestNode'] = {
      isCoreNode: false,
      nodeSource: { badgeText: 'my-pack' }
    }
    const result = usePartitionedBadges(nodeData()).value
    expect(result.core).toContainEqual({ text: 'my-pack' })
  })

  it('partitions extension badges (skipping the first) from credits badges', () => {
    const result = usePartitionedBadges(
      nodeData({
        badges: [badge('skipped'), badge('ext-badge'), badge('$5 per run')]
      })
    ).value

    expect(result.extension.map((badge) => badge.text)).toEqual(['ext-badge'])
    expect(result.pricing).toEqual([{ required: '$5', rest: 'per run' }])
  })

  it('flags hasComfyBadge for a core node with source ShowAll and no pricing', () => {
    settings['Comfy.NodeBadge.NodeSourceBadgeMode'] = NodeBadgeMode.ShowAll
    nodeDefs['TestNode'] = { isCoreNode: true }
    const result = usePartitionedBadges(
      nodeData({ badges: [badge('x')] })
    ).value
    expect(result.hasComfyBadge).toBe(true)
  })
})

describe('trackNodePrice', () => {
  it('no-ops for a node without dynamic pricing', () => {
    pricing.dynamic = false
    trackNodePrice({ id: '1', type: 'Static', inputs: [] })

    expect(getNodeRevisionRefMock).toHaveBeenCalledWith(toNodeId('1'))
    expect(getWidgetMock).not.toHaveBeenCalled()
  })

  it('touches widget, input, and input-group pricing dependencies', () => {
    pricing.dynamic = true
    pricing.widgets = ['seed']
    pricing.inputs = ['model']
    pricing.groups = ['lora']
    let modelReads = 0
    let groupReads = 0
    let unrelatedReads = 0

    trackNodePrice({
      id: '2',
      type: 'Dynamic',
      inputs: [
        inputSlot('model', () => {
          modelReads += 1
          return 1
        }),
        inputSlot('lora.0', () => {
          groupReads += 1
          return 2
        }),
        inputSlot('unrelated', () => {
          unrelatedReads += 1
          return null
        })
      ]
    })

    expect(getNodeRevisionRefMock).toHaveBeenCalledWith(toNodeId('2'))
    expect(getWidgetMock).toHaveBeenCalled()
    expect(modelReads).toBe(1)
    expect(groupReads).toBe(1)
    expect(unrelatedReads).toBe(0)
  })
})
