import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as VueI18nModule from 'vue-i18n'

const mocks = vi.hoisted(() => ({
  applyShape: vi.fn(),
  applyColor: vi.fn(),
  applyCustomColor: vi.fn(),
  adjustNodeSize: vi.fn(),
  toggleNodeCollapse: vi.fn(),
  toggleNodePin: vi.fn(),
  toggleNodeBypass: vi.fn(),
  runBranch: vi.fn(),
  getCurrentAppliedColor: vi.fn<() => string | null>(() => null)
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

vi.mock('./useNodeCustomization', () => ({
  useNodeCustomization: () => ({
    shapeOptions: [],
    applyShape: mocks.applyShape,
    applyColor: mocks.applyColor,
    applyCustomColor: mocks.applyCustomColor,
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
    favoriteColors: { value: [] },
    recentColors: { value: [] },
    getCurrentAppliedColor: mocks.getCurrentAppliedColor,
    isLightTheme: { value: false }
  })
}))

vi.mock('./useSelectedNodeActions', () => ({
  useSelectedNodeActions: () => ({
    adjustNodeSize: mocks.adjustNodeSize,
    toggleNodeCollapse: mocks.toggleNodeCollapse,
    toggleNodePin: mocks.toggleNodePin,
    toggleNodeBypass: mocks.toggleNodeBypass,
    runBranch: mocks.runBranch
  })
}))

describe('useNodeMenuOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentAppliedColor.mockReturnValue(null)
  })

  it('keeps the custom node color entry unset when there is no shared applied color', async () => {
    const { useNodeMenuOptions } = await import('./useNodeMenuOptions')
    const { colorSubmenu } = useNodeMenuOptions()

    const customEntry = colorSubmenu.value.find(
      (entry) => entry.label === 'g.custom'
    )

    expect(customEntry).toBeDefined()
    expect(customEntry?.color).toBeUndefined()
    expect(customEntry?.pickerValue).toBe('353535')
  })

  it('preserves the shared applied color for the custom node color entry', async () => {
    mocks.getCurrentAppliedColor.mockReturnValue('#abcdef')

    const { useNodeMenuOptions } = await import('./useNodeMenuOptions')
    const { colorSubmenu } = useNodeMenuOptions()

    const customEntry = colorSubmenu.value.find(
      (entry) => entry.label === 'g.custom'
    )

    expect(customEntry).toBeDefined()
    expect(customEntry?.color).toBe('#abcdef')
    expect(customEntry?.pickerValue).toBe('abcdef')
  })
})
