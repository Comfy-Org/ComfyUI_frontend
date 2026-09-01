import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ZoomControlsModal from '@/components/graph/modals/ZoomControlsModal.vue'

const mockExecute = vi.fn()
const mockGetCommand = vi.fn().mockImplementation((commandId: string) => ({
  keybinding: {
    combo: {
      getKeySequences: () => [
        'Ctrl',
        commandId === 'Comfy.Canvas.ZoomIn'
          ? '+'
          : commandId === 'Comfy.Canvas.ZoomOut'
            ? '-'
            : '0'
      ]
    }
  }
}))
const mockFormatKeySequence = vi
  .fn()
  .mockImplementation(
    (command: {
      keybinding: { combo: { getKeySequences: () => string[] } }
    }) => {
      const seq = command.keybinding.combo.getKeySequences()
      if (seq.includes('+')) return 'Ctrl+'
      if (seq.includes('-')) return 'Ctrl-'
      return 'Ctrl+0'
    }
  )
const mockSetAppZoom = vi.fn()
const mockSettingGet = vi.fn().mockReturnValue(true)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

vi.mock('@/renderer/extensions/minimap/composables/useMinimap', () => ({
  useMinimap: () => ({
    containerStyles: {
      value: { backgroundColor: '#fff', borderRadius: '8px' }
    }
  })
}))

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    execute: mockExecute,
    getCommand: mockGetCommand,
    formatKeySequence: mockFormatKeySequence
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    appScalePercentage: 100,
    setAppZoomFromPercentage: mockSetAppZoom
  })
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: mockSettingGet
  })
}))

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
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should execute zoom in command when zoom in button is clicked', async () => {
    const user = userEvent.setup()
    renderComponent()

    const zoomInButton = screen.getByTestId('zoom-in-action')
    await user.click(zoomInButton)

    expect(mockExecute).toHaveBeenCalledWith('Comfy.Canvas.ZoomIn')
  })

  it('should execute zoom out command when zoom out button is clicked', async () => {
    const user = userEvent.setup()
    renderComponent()

    const zoomOutButton = screen.getByTestId('zoom-out-action')
    await user.click(zoomOutButton)

    expect(mockExecute).toHaveBeenCalledWith('Comfy.Canvas.ZoomOut')
  })

  it('should execute fit view command when fit view button is clicked', async () => {
    const user = userEvent.setup()
    renderComponent()

    const fitViewButton = screen.getByTestId('zoom-to-fit-action')
    await user.click(fitViewButton)

    expect(mockExecute).toHaveBeenCalledWith('Comfy.Canvas.FitView')
  })

  it('should call setAppZoomFromPercentage with valid zoom input values', async () => {
    const user = userEvent.setup()
    renderComponent()

    const input = screen.getByRole('spinbutton')
    await user.tripleClick(input)
    await user.keyboard('150')

    expect(mockSetAppZoom).toHaveBeenCalledWith(150)
  })

  it('should not call setAppZoomFromPercentage when value is below minimum', async () => {
    const user = userEvent.setup()
    renderComponent()

    const input = screen.getByRole('spinbutton')
    await user.tripleClick(input)
    await user.keyboard('0')

    expect(mockSetAppZoom).not.toHaveBeenCalled()
  })

  it('should not apply zoom values exceeding the maximum', async () => {
    const user = userEvent.setup()
    renderComponent()

    const input = screen.getByRole('spinbutton')
    await user.tripleClick(input)
    await user.keyboard('100')
    mockSetAppZoom.mockClear()

    await user.keyboard('1')

    expect(mockSetAppZoom).not.toHaveBeenCalled()
  })

  it('should display keyboard shortcuts for commands', () => {
    renderComponent()

    expect(screen.getByText('Ctrl+')).toBeInTheDocument()
    expect(screen.getByText('Ctrl-')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+0')).toBeInTheDocument()
    expect(mockGetCommand).toHaveBeenCalledWith('Comfy.Canvas.ZoomIn')
    expect(mockGetCommand).toHaveBeenCalledWith('Comfy.Canvas.ZoomOut')
    expect(mockGetCommand).toHaveBeenCalledWith('Comfy.Canvas.FitView')
  })

  it('should not be visible when visible prop is false', () => {
    renderComponent({ visible: false })

    expect(screen.queryByTestId('zoom-in-action')).toBeNull()
  })
})
