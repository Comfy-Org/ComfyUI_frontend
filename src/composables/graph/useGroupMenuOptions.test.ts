import { render } from '@testing-library/vue'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import { useGroupMenuOptions } from '@/composables/graph/useGroupMenuOptions'
import { LGraphCanvas, LGraphGroup } from '@/lib/litegraph/src/litegraph'
import { setCanvasSelection } from '@/utils/__tests__/canvasSelectionTestUtils'

// canvasStore transitively imports the app singleton; stub it so the real
// ComfyApp module never loads during these unit tests.
vi.mock('@/scripts/app', () => ({
  app: { canvas: { selected_nodes: null } }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

describe('useGroupMenuOptions.getGroupColorOptions', () => {
  it('applies the same colour as the circle-swatch picker (LGraphCanvas.node_colors groupcolor)', () => {
    const group = new LGraphGroup('Test Group')
    setCanvasSelection([group])

    let submenu: { label: string; action: () => void }[] = []
    const Wrapper = defineComponent({
      setup() {
        const { getGroupColorOptions } = useGroupMenuOptions()
        submenu = getGroupColorOptions(group, () => {}).submenu ?? []
        return () => null
      }
    })
    render(Wrapper, { global: { plugins: [i18n] } })

    const paleBlueOption = submenu.find(
      (option) => option.label === 'color.pale_blue'
    )
    expect(paleBlueOption).toBeDefined()

    paleBlueOption?.action()

    expect(group.color).toBe(LGraphCanvas.node_colors.pale_blue.groupcolor)
    expect(group.color).not.toBe(LGraphCanvas.node_colors.pale_blue.bgcolor)
  })
})
