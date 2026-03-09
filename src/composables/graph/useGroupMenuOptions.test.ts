import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as VueI18nModule from 'vue-i18n'

import { LGraphGroup, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type * as NodeColorCustomizationModule from '@/utils/nodeColorCustomization'

const mocks = vi.hoisted(() => ({
  refreshCanvas: vi.fn(),
  rememberRecentColor: vi.fn().mockResolvedValue(undefined),
  selectedItems: [] as unknown[]
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof VueI18nModule>()

  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    selectedItems: mocks.selectedItems,
    canvas: {
      setDirty: vi.fn()
    }
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn()
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: null
  })
}))

vi.mock('@/composables/graph/useCanvasRefresh', () => ({
  useCanvasRefresh: () => ({
    refreshCanvas: mocks.refreshCanvas
  })
}))

vi.mock('@/composables/graph/useCustomNodeColorSettings', () => ({
  useCustomNodeColorSettings: () => ({
    darkerHeader: { value: true },
    favoriteColors: { value: ['#abcdef'] },
    recentColors: { value: [] },
    rememberRecentColor: mocks.rememberRecentColor
  })
}))

vi.mock('@/composables/graph/useNodeCustomization', () => ({
  useNodeCustomization: () => ({
    colorOptions: [
      {
        name: 'noColor',
        localizedName: 'color.noColor',
        value: {
          dark: '#353535',
          light: '#6f6f6f'
        }
      }
    ],
    isLightTheme: { value: false },
    shapeOptions: []
  })
}))

vi.mock('@/utils/nodeColorCustomization', async () =>
  vi.importActual<typeof NodeColorCustomizationModule>(
    '@/utils/nodeColorCustomization'
  )
)

function createNode() {
  return Object.assign(Object.create(LGraphNode.prototype), {
    color: undefined,
    bgcolor: undefined,
    getColorOption: () => null
  }) as LGraphNode
}

function createGroup(color?: string) {
  return Object.assign(Object.create(LGraphGroup.prototype), {
    color,
    getColorOption: () => null
  }) as LGraphGroup
}

describe('useGroupMenuOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.selectedItems = []
  })

  it('applies saved custom colors to the group context only', async () => {
    const selectedNode = createNode()
    const groupContext = createGroup()
    mocks.selectedItems = [selectedNode, groupContext]

    const { useGroupMenuOptions } = await import('./useGroupMenuOptions')
    const { getGroupColorOptions } = useGroupMenuOptions()
    const bump = vi.fn()

    const colorMenu = getGroupColorOptions(groupContext, bump)
    const favoriteEntry = colorMenu.submenu?.find((entry) =>
      entry.label.includes('#ABCDEF')
    )

    expect(favoriteEntry).toBeDefined()

    await favoriteEntry?.action()

    expect(groupContext.color).toBe('#abcdef')
    expect(selectedNode.bgcolor).toBeUndefined()
    expect(mocks.refreshCanvas).toHaveBeenCalledOnce()
    expect(mocks.rememberRecentColor).toHaveBeenCalledWith('#abcdef')
    expect(bump).toHaveBeenCalledOnce()
    expect(mocks.rememberRecentColor.mock.invocationCallOrder[0]).toBeLessThan(
      bump.mock.invocationCallOrder[0]
    )
  })

  it('seeds the PrimeVue custom picker from the clicked group color', async () => {
    const selectedNode = createNode()
    selectedNode.bgcolor = '#445566'
    const groupContext = createGroup('#112233')
    mocks.selectedItems = [selectedNode, groupContext]

    const { useGroupMenuOptions } = await import('./useGroupMenuOptions')
    const { getGroupColorOptions } = useGroupMenuOptions()
    const bump = vi.fn()
    const colorMenu = getGroupColorOptions(groupContext, bump)
    const customEntry = colorMenu.submenu?.find(
      (entry) => entry.label === 'g.custom'
    )

    expect(customEntry).toBeDefined()
    expect(customEntry?.color).toBe('#112233')
    expect(customEntry?.pickerValue).toBe('112233')

    await customEntry?.onColorPick?.('#fedcba')

    expect(groupContext.color).toBe('#fedcba')
    expect(selectedNode.bgcolor).toBe('#445566')
    expect(mocks.rememberRecentColor).toHaveBeenCalledWith('#fedcba')
    expect(mocks.rememberRecentColor.mock.invocationCallOrder[0]).toBeLessThan(
      bump.mock.invocationCallOrder[0]
    )
  })
})
