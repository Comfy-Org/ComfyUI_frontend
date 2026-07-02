import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import type { App as VueApp } from 'vue'

import { useNodeBadge } from '@/composables/node/useNodeBadge'
import { BadgePosition, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraphBadge } from '@/lib/litegraph/src/litegraph'
import type { ComfyExtension } from '@/types/comfy'
import { toNodeId } from '@/types/nodeId'
import { NodeBadgeMode } from '@/types/nodeSource'

const {
  settings,
  appState,
  extensionState,
  nodeDefState,
  pricingState,
  setDirtyMock,
  addEventListenerMock,
  registerExtensionMock,
  getCreditsBadgeMock,
  updateSubgraphCreditsMock,
  getNodePricingConfigMock,
  getNodeDisplayPriceMock,
  getRelevantWidgetNamesMock,
  triggerPriceRecalculationMock,
  useComputedWithWidgetWatchMock
} = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  appState: {
    graph: {
      nodes: [] as unknown[]
    }
  },
  extensionState: {
    installed: false,
    registered: undefined as ComfyExtension | undefined
  },
  nodeDefState: {
    value: null as Record<string, unknown> | null
  },
  pricingState: {
    revision: { value: 0 },
    config: undefined as
      | {
          depends_on?: {
            widgets?: string[]
            inputs?: string[]
            input_groups?: string[]
          }
        }
      | undefined,
    label: '1 credit'
  },
  setDirtyMock: vi.fn(),
  addEventListenerMock: vi.fn(),
  registerExtensionMock: vi.fn((extension: ComfyExtension) => {
    extensionState.registered = extension
  }),
  getCreditsBadgeMock: vi.fn((text: string) => ({ text })),
  updateSubgraphCreditsMock: vi.fn(),
  getNodePricingConfigMock: vi.fn(() => pricingState.config),
  getNodeDisplayPriceMock: vi.fn(() => pricingState.label),
  getRelevantWidgetNamesMock: vi.fn(() => ['seed']),
  triggerPriceRecalculationMock: vi.fn(),
  useComputedWithWidgetWatchMock: vi.fn(() => vi.fn())
}))

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      setDirty: setDirtyMock,
      canvas: {
        addEventListener: addEventListenerMock
      },
      graph: appState.graph
    }
  }
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => settings[key]
  })
}))

vi.mock('@/stores/extensionStore', () => ({
  useExtensionStore: () => ({
    isExtensionInstalled: () => extensionState.installed,
    registerExtension: registerExtensionMock
  })
}))

vi.mock('@/stores/nodeDefStore', () => ({
  useNodeDefStore: () => ({
    fromLGraphNode: () => nodeDefState.value
  })
}))

vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: () => ({
    completedActivePalette: {
      colors: {
        litegraph_base: {
          BADGE_FG_COLOR: '#fff',
          BADGE_BG_COLOR: '#000'
        }
      }
    }
  })
}))

vi.mock('@/composables/node/useNodePricing', async () => {
  const { ref } = await import('vue')
  const pricingRevision = ref(pricingState.revision.value)
  Object.defineProperty(pricingState.revision, 'value', {
    get: () => pricingRevision.value,
    set: (value: number) => {
      pricingRevision.value = value
    }
  })
  return {
    useNodePricing: () => ({
      pricingRevision,
      getNodePricingConfig: getNodePricingConfigMock,
      getNodeDisplayPrice: getNodeDisplayPriceMock,
      getRelevantWidgetNames: getRelevantWidgetNamesMock,
      triggerPriceRecalculation: triggerPriceRecalculationMock
    })
  }
})

vi.mock('@/composables/node/usePriceBadge', () => ({
  usePriceBadge: () => ({
    getCreditsBadge: getCreditsBadgeMock,
    updateSubgraphCredits: updateSubgraphCreditsMock
  })
}))

vi.mock('@/composables/node/useWatchWidget', () => ({
  useComputedWithWidgetWatch: useComputedWithWidgetWatchMock
}))

class ApiNode extends LGraphNode {
  static override nodeData = { name: 'ApiNode', api_node: true }
}

function mountBadge(): VueApp {
  const app = createApp(
    defineComponent({
      setup() {
        useNodeBadge()
        return () => h('div')
      }
    })
  )
  app.mount(document.createElement('div'))
  return app
}

function registeredExtension(): ComfyExtension {
  if (!extensionState.registered)
    throw new Error('Missing registered extension')
  return extensionState.registered
}

function comfyApp(): Parameters<NonNullable<ComfyExtension['init']>>[0] {
  return {} as Parameters<NonNullable<ComfyExtension['init']>>[0]
}

function callNodeCreated(node: LGraphNode) {
  registeredExtension().nodeCreated?.(node, comfyApp())
}

function inputSlot(name: string) {
  return new LGraphNode('slot').addInput(name, '*')
}

function defaultSettings() {
  settings['Comfy.NodeBadge.NodeSourceBadgeMode'] = NodeBadgeMode.None
  settings['Comfy.NodeBadge.NodeIdBadgeMode'] = NodeBadgeMode.None
  settings['Comfy.NodeBadge.NodeLifeCycleBadgeMode'] = NodeBadgeMode.None
  settings['Comfy.NodeBadge.ShowApiPricing'] = false
}

describe('useNodeBadge', () => {
  let mountedApp: VueApp | undefined

  beforeEach(() => {
    defaultSettings()
    extensionState.installed = false
    extensionState.registered = undefined
    appState.graph.nodes = []
    nodeDefState.value = null
    pricingState.revision.value = 0
    pricingState.config = undefined
    pricingState.label = '1 credit'
    setDirtyMock.mockClear()
    addEventListenerMock.mockClear()
    registerExtensionMock.mockClear()
    getCreditsBadgeMock.mockClear()
    updateSubgraphCreditsMock.mockClear()
    getNodePricingConfigMock.mockClear()
    getNodeDisplayPriceMock.mockClear()
    getRelevantWidgetNamesMock.mockClear()
    triggerPriceRecalculationMock.mockClear()
    useComputedWithWidgetWatchMock.mockClear()
  })

  afterEach(() => {
    mountedApp?.unmount()
    mountedApp = undefined
  })

  it('does not register the badge extension twice', async () => {
    extensionState.installed = true
    mountedApp = mountBadge()
    await nextTick()

    expect(registerExtensionMock).not.toHaveBeenCalled()
  })

  it('adds the configured node identity badge', async () => {
    settings['Comfy.NodeBadge.NodeSourceBadgeMode'] = NodeBadgeMode.ShowAll
    settings['Comfy.NodeBadge.NodeIdBadgeMode'] = NodeBadgeMode.ShowAll
    settings['Comfy.NodeBadge.NodeLifeCycleBadgeMode'] =
      NodeBadgeMode.HideBuiltIn
    nodeDefState.value = {
      isCoreNode: false,
      nodeLifeCycleBadgeText: 'Beta',
      nodeSource: { badgeText: 'Pack' }
    }
    const node = new LGraphNode('Test')
    node.id = toNodeId('7')

    mountedApp = mountBadge()
    await nextTick()
    callNodeCreated(node)
    const badge = node.badges[0] as () => LGraphBadge

    expect(node.badgePosition).toBe(BadgePosition.TopRight)
    expect(badge().text).toBe('#7 Beta Pack')
  })

  it('hides built-in badge text when the mode excludes core nodes', async () => {
    settings['Comfy.NodeBadge.NodeSourceBadgeMode'] = NodeBadgeMode.HideBuiltIn
    settings['Comfy.NodeBadge.NodeIdBadgeMode'] = NodeBadgeMode.ShowAll
    settings['Comfy.NodeBadge.NodeLifeCycleBadgeMode'] =
      NodeBadgeMode.HideBuiltIn
    nodeDefState.value = {
      isCoreNode: true,
      nodeLifeCycleBadgeText: 'Core',
      nodeSource: { badgeText: 'Built-in' }
    }
    const node = new LGraphNode('Core')
    node.id = toNodeId('11')

    mountedApp = mountBadge()
    await nextTick()
    callNodeCreated(node)
    const badge = node.badges[0] as () => LGraphBadge

    expect(badge().text).toBe('#11')
  })

  it('keeps optional node definition badge text empty', async () => {
    settings['Comfy.NodeBadge.NodeSourceBadgeMode'] = NodeBadgeMode.ShowAll
    settings['Comfy.NodeBadge.NodeIdBadgeMode'] = NodeBadgeMode.ShowAll
    settings['Comfy.NodeBadge.NodeLifeCycleBadgeMode'] = NodeBadgeMode.ShowAll
    nodeDefState.value = null
    const node = new LGraphNode('NoDef')
    node.id = toNodeId('13')

    mountedApp = mountBadge()
    await nextTick()
    callNodeCreated(node)
    const badge = node.badges[0] as () => LGraphBadge

    expect(badge().text).toBe('#13')
  })

  it('marks the canvas dirty when pricing changes while pricing badges are visible', async () => {
    settings['Comfy.NodeBadge.ShowApiPricing'] = true
    mountedApp = mountBadge()
    await nextTick()

    pricingState.revision.value++
    await nextTick()

    expect(setDirtyMock).toHaveBeenCalledWith(true, true)
  })

  it('does not add API pricing badges when the pricing setting is disabled', async () => {
    settings['Comfy.NodeBadge.ShowApiPricing'] = false
    const node = new ApiNode('API')

    mountedApp = mountBadge()
    await nextTick()
    callNodeCreated(node)

    expect(node.badges).toHaveLength(1)
    expect(getCreditsBadgeMock).not.toHaveBeenCalled()
  })

  it('adds static API pricing badges without widget watchers', async () => {
    settings['Comfy.NodeBadge.ShowApiPricing'] = true
    pricingState.config = undefined
    const node = new ApiNode('API')

    mountedApp = mountBadge()
    await nextTick()
    callNodeCreated(node)

    expect(node.badges).toHaveLength(2)
    expect(useComputedWithWidgetWatchMock).not.toHaveBeenCalled()
    expect(getCreditsBadgeMock).toHaveBeenCalledWith('1 credit')
  })

  it('adds dynamic widget pricing without connection hooks when no inputs matter', async () => {
    settings['Comfy.NodeBadge.ShowApiPricing'] = true
    pricingState.config = {
      depends_on: {
        widgets: ['seed']
      }
    }
    const node = new ApiNode('API')
    const originalOnConnectionsChange = node.onConnectionsChange

    mountedApp = mountBadge()
    await nextTick()
    callNodeCreated(node)

    expect(useComputedWithWidgetWatchMock).toHaveBeenCalled()
    expect(node.onConnectionsChange).toBe(originalOnConnectionsChange)
  })

  it('adds dynamic API pricing badges and refreshes relevant input changes', async () => {
    settings['Comfy.NodeBadge.ShowApiPricing'] = true
    pricingState.config = {
      depends_on: {
        widgets: ['seed'],
        inputs: ['image'],
        input_groups: ['lora']
      }
    }
    const originalOnConnectionsChange = vi.fn()
    const node = new ApiNode('API')
    node.onConnectionsChange = originalOnConnectionsChange

    mountedApp = mountBadge()
    await nextTick()
    callNodeCreated(node)

    expect(useComputedWithWidgetWatchMock).toHaveBeenCalledWith(node, {
      widgetNames: ['seed'],
      triggerCanvasRedraw: true
    })
    expect(getCreditsBadgeMock).toHaveBeenCalledWith('1 credit')

    const priceBadge = node.badges[1] as () => { text: string }
    expect(priceBadge().text).toBe('1 credit')
    pricingState.label = '2 credits'
    expect(priceBadge().text).toBe('2 credits')

    node.onConnectionsChange?.(1, 0, true, undefined, inputSlot('image'))
    node.onConnectionsChange?.(1, 0, true, undefined, inputSlot('lora.0'))
    node.onConnectionsChange?.(1, 0, true, undefined, inputSlot('clip'))
    node.onConnectionsChange?.(1, 0, true, undefined, inputSlot(''))

    expect(originalOnConnectionsChange).toHaveBeenCalledTimes(4)
    expect(triggerPriceRecalculationMock).toHaveBeenCalledTimes(2)
    expect(triggerPriceRecalculationMock).toHaveBeenCalledWith(node)
  })

  it('refreshes dynamic pricing inputs without an existing connection hook', async () => {
    settings['Comfy.NodeBadge.ShowApiPricing'] = true
    pricingState.config = {
      depends_on: {
        inputs: ['image']
      }
    }
    const node = new ApiNode('API')

    mountedApp = mountBadge()
    await nextTick()
    callNodeCreated(node)

    node.onConnectionsChange?.(1, 0, true, undefined, inputSlot('image'))

    expect(triggerPriceRecalculationMock).toHaveBeenCalledWith(node)
  })

  it('updates subgraph credit badges from registered extension hooks', async () => {
    const nodes = [new LGraphNode('one'), new LGraphNode('two')]
    appState.graph.nodes = nodes

    mountedApp = mountBadge()
    await nextTick()
    await registeredExtension().init?.(comfyApp())
    await registeredExtension().afterConfigureGraph?.([], comfyApp())

    const setGraphHandler = addEventListenerMock.mock.calls.find(
      ([event]) => event === 'litegraph:set-graph'
    )?.[1]
    const convertedHandler = addEventListenerMock.mock.calls.find(
      ([event]) => event === 'subgraph-converted'
    )?.[1]
    setGraphHandler?.()
    convertedHandler?.({ detail: { subgraphNode: nodes[0] } })

    expect(updateSubgraphCreditsMock).toHaveBeenCalledWith(nodes[0])
    expect(updateSubgraphCreditsMock).toHaveBeenCalledWith(nodes[1])
  })

  it('handles empty graph nodes during registered extension hooks', async () => {
    appState.graph.nodes = undefined as unknown as LGraphNode[]

    mountedApp = mountBadge()
    await nextTick()
    await registeredExtension().init?.(comfyApp())
    await registeredExtension().afterConfigureGraph?.([], comfyApp())

    const setGraphHandler = addEventListenerMock.mock.calls.find(
      ([event]) => event === 'litegraph:set-graph'
    )?.[1]
    setGraphHandler?.()

    expect(updateSubgraphCreditsMock).not.toHaveBeenCalled()
  })
})
