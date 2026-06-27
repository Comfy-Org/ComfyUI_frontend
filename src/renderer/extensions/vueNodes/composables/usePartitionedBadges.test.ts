import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { usePartitionedBadges } from '@/renderer/extensions/vueNodes/composables/usePartitionedBadges'
import { NodeBadgeMode } from '@/types/nodeSource'

const { settings, nodeDefs } = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  nodeDefs: {} as Record<string, unknown>
}))

vi.mock('@/scripts/app', () => ({ app: {} }))

vi.mock('@/composables/node/useNodePricing', () => ({
  useNodePricing: () => ({
    getRelevantWidgetNames: () => [],
    hasDynamicPricing: () => false,
    getInputGroupPrefixes: () => [],
    getInputNames: () => [],
    getNodeRevisionRef: () => ({ value: 0 })
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
  useWidgetValueStore: () => ({ getWidget: () => undefined })
}))

function nodeData(over: Record<string, unknown> = {}): VueNodeData {
  return {
    id: '1',
    type: 'TestNode',
    apiNode: false,
    badges: [],
    inputs: [],
    ...over
  } as unknown as VueNodeData
}

beforeEach(() => {
  settings['Comfy.NodeBadge.NodeSourceBadgeMode'] = NodeBadgeMode.None
  settings['Comfy.NodeBadge.NodeLifeCycleBadgeMode'] = NodeBadgeMode.None
  settings['Comfy.NodeBadge.NodeIdBadgeMode'] = NodeBadgeMode.None
  for (const k of Object.keys(nodeDefs)) delete nodeDefs[k]
  nodeDefs['TestNode'] = { isCoreNode: false }
})

describe('usePartitionedBadges', () => {
  it('emits no core badges when every badge mode is None', () => {
    const result = usePartitionedBadges(nodeData()).value
    expect(result.core).toEqual([])
  })

  it('adds an id badge when the id mode is enabled', () => {
    settings['Comfy.NodeBadge.NodeIdBadgeMode'] = NodeBadgeMode.ShowAll
    const result = usePartitionedBadges(nodeData({ id: '7' })).value
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
        badges: [
          { text: 'skipped' },
          { text: 'ext-badge' },
          { text: '$5 per run' }
        ]
      })
    ).value

    expect(result.extension).toEqual([{ text: 'ext-badge' }])
    expect(result.pricing).toEqual([{ required: '$5', rest: 'per run' }])
  })

  it('flags hasComfyBadge for a core node with source ShowAll and no pricing', () => {
    settings['Comfy.NodeBadge.NodeSourceBadgeMode'] = NodeBadgeMode.ShowAll
    nodeDefs['TestNode'] = { isCoreNode: true }
    const result = usePartitionedBadges(
      nodeData({ badges: [{ text: 'x' }] })
    ).value
    expect(result.hasComfyBadge).toBe(true)
  })
})
