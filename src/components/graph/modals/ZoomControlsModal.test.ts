import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ZoomControlsModal from '@/components/graph/modals/ZoomControlsModal.vue'
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useCommandStore } from '@/stores/commandStore'

beforeEach(() => {
  vi.mocked(useCommandStore().execute).mockResolvedValue(undefined)
  vi.mocked(useCommandStore().formatKeySequence).mockImplementation(
    (command) =>
      command.id === 'Comfy.Canvas.ZoomIn'
        ? 'Ctrl+'
        : command.id === 'Comfy.Canvas.ZoomOut'
          ? 'Ctrl-'
          : 'Ctrl+0'
  )
  for (const [commandId, key] of [
    ['Comfy.Canvas.ZoomIn', '+'],
    ['Comfy.Canvas.ZoomOut', '-'],
    ['Comfy.Canvas.FitView', '0']
  ]) {
    useCommandStore().registerCommand({ id: commandId, function: vi.fn() })
    useKeybindingStore().addDefaultKeybinding(
      new KeybindingImpl({ commandId, combo: { key, ctrl: true } })
    )
  }
  vi.mocked(useCanvasStore().setAppZoomFromPercentage).mockImplementation(
    () => {}
  )
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

vi.mock<unknown>(
  import('@/renderer/extensions/minimap/composables/useMinimap'),

  () => ({
    useMinimap: () => ({
      containerStyles: {
        value: { backgroundColor: '#fff', borderRadius: '8px' }
      }
    })
  })
)

function renderComponent(props = {}) {
  return render(ZoomControlsModal, {
    props: {
      visible: true,
      ...props
    },
    global: {
      plugins: [i18n],
      stubs: {
        Button: false,
        InputNumber: false
      }
    }
  })
}

describe('ZoomControlsModal', () => {
  it('should execute zoom in command when zoom in button is clicked', async () => {
    const user = userEvent.setup()
    renderComponent()

    const zoomInButton = screen.getByTestId('zoom-in-action')
    await user.click(zoomInButton)

    expect(vi.mocked(useCommandStore().execute)).toHaveBeenCalledWith(
      'Comfy.Canvas.ZoomIn'
    )
  })

  it('should execute zoom out command when zoom out button is clicked', async () => {
    const user = userEvent.setup()
    renderComponent()

    const zoomOutButton = screen.getByTestId('zoom-out-action')
    await user.click(zoomOutButton)

    expect(vi.mocked(useCommandStore().execute)).toHaveBeenCalledWith(
      'Comfy.Canvas.ZoomOut'
    )
  })

  it('should execute fit view command when fit view button is clicked', async () => {
    const user = userEvent.setup()
    renderComponent()

    const fitViewButton = screen.getByTestId('zoom-to-fit-action')
    await user.click(fitViewButton)

    expect(vi.mocked(useCommandStore().execute)).toHaveBeenCalledWith(
      'Comfy.Canvas.FitView'
    )
  })

  it.for([
    ['150', 150],
    ['0', 1],
    ['1001', 1000]
  ] as const)(
    'applies typed zoom %s clamped to the allowed range on Enter',
    async ([typed, applied]) => {
      const user = userEvent.setup()
      renderComponent()

      const input = screen.getByRole('spinbutton')
      await user.tripleClick(input)
      await user.keyboard(`${typed}{Enter}`)

      expect(
        vi.mocked(useCanvasStore().setAppZoomFromPercentage)
      ).toHaveBeenCalledExactlyOnceWith(applied)
    }
  )

  it('should display keyboard shortcuts for commands', () => {
    renderComponent()

    expect(screen.getByText('Ctrl+')).toBeInTheDocument()
    expect(screen.getByText('Ctrl-')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+0')).toBeInTheDocument()
  })

  it('should not be visible when visible prop is false', () => {
    renderComponent({ visible: false })

    expect(screen.queryByTestId('zoom-in-action')).toBeNull()
  })
})
