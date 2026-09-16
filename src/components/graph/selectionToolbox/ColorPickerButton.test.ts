import { fromPartial } from '@total-typescript/shoehorn'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import Tooltip from 'primevue/tooltip'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ColorPickerButton from '@/components/graph/selectionToolbox/ColorPickerButton.vue'
import type { Positionable } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { toGroupId } from '@/types/groupId'

function createMockPositionable(): Positionable {
  return fromPartial<Positionable>({ id: toGroupId(1), pos: [0, 0] })
}

vi.mock<unknown>(import('@/scripts/app'), () => ({ app: {} }))

describe('ColorPickerButton', () => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        color: {
          noColor: 'No Color',
          red: 'Red',
          green: 'Green',
          blue: 'Blue'
        }
      }
    }
  })

  function renderComponent() {
    const user = userEvent.setup()

    render(ColorPickerButton, {
      global: {
        plugins: [PrimeVue, i18n],
        directives: {
          tooltip: Tooltip
        }
      }
    })

    return { user }
  }

  it('should render when nodes are selected', () => {
    useCanvasStore().selectedItems = [createMockPositionable()]
    renderComponent()
    expect(screen.getByTestId('color-picker-button')).toBeInTheDocument()
  })

  it('should toggle color picker visibility on button click', async () => {
    useCanvasStore().selectedItems = [createMockPositionable()]
    const { user } = renderComponent()
    const button = screen.getByTestId('color-picker-button')

    expect(screen.queryByTestId('noColor')).not.toBeInTheDocument()

    await user.click(button)
    expect(screen.getByTestId('noColor')).toBeInTheDocument()
    expect(screen.getByTestId('red')).toBeInTheDocument()
    expect(screen.getByTestId('green')).toBeInTheDocument()
    expect(screen.getByTestId('blue')).toBeInTheDocument()

    await user.click(button)
    expect(screen.queryByTestId('noColor')).not.toBeInTheDocument()
  })
})
