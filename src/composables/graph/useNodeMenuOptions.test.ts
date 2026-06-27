import { render } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useNodeMenuOptions } from '@/composables/graph/useNodeMenuOptions'
import type { Positionable } from '@/lib/litegraph/src/litegraph'
import { LGraphEventMode, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toNodeId } from '@/types/nodeId'

const { actions, customization } = vi.hoisted(() => ({
  actions: {
    adjustNodeSize: vi.fn(),
    toggleNodeCollapse: vi.fn(),
    toggleNodePin: vi.fn(),
    toggleNodeBypass: vi.fn(),
    runBranch: vi.fn()
  },
  customization: {
    shapeOptions: [] as Array<{ localizedName: string; value: string }>,
    colorOptions: [] as Array<{
      name: string
      localizedName: string
      value: { dark: string; light: string }
    }>,
    applyShape: vi.fn(),
    applyColor: vi.fn(),
    isLightTheme: { value: false }
  }
}))

vi.mock('@/scripts/app', () => ({
  app: { canvas: { selected_nodes: null } }
}))

vi.mock('@/composables/graph/useNodeCustomization', () => ({
  useNodeCustomization: () => ({
    shapeOptions: customization.shapeOptions,
    applyShape: customization.applyShape,
    applyColor: customization.applyColor,
    colorOptions: customization.colorOptions,
    isLightTheme: customization.isLightTheme
  })
}))

vi.mock('@/composables/graph/useSelectedNodeActions', () => ({
  useSelectedNodeActions: () => actions
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

const nodeWithMode = (mode: LGraphEventMode, id = 1): LGraphNode => {
  const node = new LGraphNode('Test')
  node.id = toNodeId(id)
  node.mode = mode
  return node
}

const getBypassLabel = (selected: LGraphNode[]): string => {
  const canvasStore = useCanvasStore()
  vi.spyOn(canvasStore, 'canvas', 'get').mockReturnValue({
    selectedItems: new Set<Positionable>(selected)
  } as ReturnType<typeof canvasStore.getCanvas>)

  let label = ''
  const Wrapper = defineComponent({
    setup() {
      const { getBypassOption } = useNodeMenuOptions()
      label = getBypassOption(() => {}).label ?? ''
      return () => null
    }
  })
  render(Wrapper, { global: { plugins: [i18n] } })
  return label
}

function readNodeMenuOptions<T>(
  read: (options: ReturnType<typeof useNodeMenuOptions>) => T
): T {
  const unread = Symbol('unread')
  const result: { value: T | typeof unread } = { value: unread }
  const Wrapper = defineComponent({
    setup() {
      result.value = read(useNodeMenuOptions())
      return () => null
    }
  })
  render(Wrapper, { global: { plugins: [i18n] } })
  if (result.value === unread) throw new Error('Composable was not read')
  return result.value
}

describe('useNodeMenuOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    customization.shapeOptions = []
    customization.colorOptions = []
    customization.isLightTheme.value = false
  })

  it('labels as "Bypass" when no node is bypassed', () => {
    expect(getBypassLabel([nodeWithMode(LGraphEventMode.ALWAYS, 1)])).toBe(
      'contextMenu.Bypass'
    )
  })

  it('labels as "Remove Bypass" when every selected node is bypassed', () => {
    expect(
      getBypassLabel([
        nodeWithMode(LGraphEventMode.BYPASS, 1),
        nodeWithMode(LGraphEventMode.BYPASS, 2)
      ])
    ).toBe('contextMenu.Remove Bypass')
  })

  it('labels as "Bypass" on mixed selection so it matches the toggle action', () => {
    expect(
      getBypassLabel([
        nodeWithMode(LGraphEventMode.BYPASS, 1),
        nodeWithMode(LGraphEventMode.ALWAYS, 2)
      ])
    ).toBe('contextMenu.Bypass')
  })

  it('labels visual node options from the collapsed state and bumps after action', () => {
    const expandBump = vi.fn()
    const expand = readNodeMenuOptions(
      ({ getNodeVisualOptions }) =>
        getNodeVisualOptions({ collapsed: true, pinned: false }, expandBump)[0]
    )
    expect(expand).toMatchObject({
      label: 'contextMenu.Expand Node',
      icon: 'icon-[lucide--maximize-2]'
    })
    expand.action?.()
    expect(actions.toggleNodeCollapse).toHaveBeenCalledTimes(1)
    expect(expandBump).toHaveBeenCalledTimes(1)

    const minimize = readNodeMenuOptions(
      ({ getNodeVisualOptions }) =>
        getNodeVisualOptions({ collapsed: false, pinned: false }, vi.fn())[0]
    )
    expect(minimize).toMatchObject({
      label: 'contextMenu.Minimize Node',
      icon: 'icon-[lucide--minimize-2]'
    })
  })

  it('labels pin options from the pinned state and bumps after action', () => {
    const bump = vi.fn()
    const unpin = readNodeMenuOptions(({ getPinOption }) =>
      getPinOption({ collapsed: false, pinned: true }, bump)
    )
    expect(unpin).toMatchObject({
      label: 'contextMenu.Unpin',
      icon: 'icon-[lucide--pin-off]'
    })
    unpin.action?.()
    expect(actions.toggleNodePin).toHaveBeenCalledTimes(1)
    expect(bump).toHaveBeenCalledTimes(1)

    const pin = readNodeMenuOptions(({ getPinOption }) =>
      getPinOption({ collapsed: false, pinned: false }, vi.fn())
    )
    expect(pin).toMatchObject({
      label: 'contextMenu.Pin',
      icon: 'icon-[lucide--pin]'
    })
  })

  it('builds shape and color submenus and applies selected values', () => {
    customization.shapeOptions = [{ localizedName: 'Box', value: 'box' }]
    customization.colorOptions = [
      {
        name: 'noColor',
        localizedName: 'No Color',
        value: { dark: '#000', light: '#fff' }
      },
      {
        name: 'red',
        localizedName: 'Red',
        value: { dark: '#111', light: '#eee' }
      }
    ]

    const { visualOptions, colorSubmenu } = readNodeMenuOptions((options) => ({
      visualOptions: options.getNodeVisualOptions(
        { collapsed: false, pinned: false },
        vi.fn()
      ),
      colorSubmenu: options.colorSubmenu.value
    }))

    expect(visualOptions[1].submenu).toEqual([
      expect.objectContaining({ label: 'Box' })
    ])
    visualOptions[1].submenu?.[0].action()
    expect(customization.applyShape).toHaveBeenCalledWith(
      customization.shapeOptions[0]
    )

    expect(colorSubmenu).toEqual([
      expect.objectContaining({ label: 'No Color', color: '#000' }),
      expect.objectContaining({ label: 'Red', color: '#111' })
    ])
    colorSubmenu[0].action()
    colorSubmenu[1].action()
    expect(customization.applyColor).toHaveBeenNthCalledWith(1, null)
    expect(customization.applyColor).toHaveBeenNthCalledWith(
      2,
      customization.colorOptions[1]
    )
  })

  it('uses light-theme colors for the color submenu', () => {
    customization.isLightTheme.value = true
    customization.colorOptions = [
      {
        name: 'red',
        localizedName: 'Red',
        value: { dark: '#111', light: '#eee' }
      }
    ]

    expect(
      readNodeMenuOptions((options) => options.colorSubmenu.value[0].color)
    ).toBe('#eee')
  })
})
