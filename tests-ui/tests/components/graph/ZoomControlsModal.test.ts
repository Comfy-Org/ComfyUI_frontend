import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import ZoomControlsModal from '@/components/graph/modals/ZoomControlsModal.vue'

// Mock functions
const mockExecute = vi.fn()
const mockGetCommand = vi.fn().mockReturnValue({
  keybinding: {
    combo: {
      getKeySequences: () => ['Ctrl', '+']
    }
  }
})
const mockFormatKeySequence = vi.fn().mockReturnValue('Ctrl+')
const mockSetAppZoom = vi.fn()
const mockSettingGet = vi.fn().mockReturnValue(true)

// Mock dependencies
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/renderer/extensions/minimap/composables/useMinimap', () => ({
  useMinimap: () => ({
    containerStyles: { value: { backgroundColor: '#fff', borderRadius: '8px' } }
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

const createWrapper = (props = {}) => {
  return mount(ZoomControlsModal, {
    props: {
      visible: true,
      ...props
    },
    global: {
      stubs: {
        Button: false,
        InputNumber: false
      }
    }
  })
}

describe('ZoomControlsModal', () => {
  it('should execute zoom in command when zoom in button is clicked', async () => {
    mockExecute.mockClear()
    const wrapper = createWrapper()

    const buttons = wrapper.findAll('button')
    const zoomInButton = buttons.find((btn) =>
      btn.text().includes('graphCanvasMenu.zoomIn')
    )

    expect(zoomInButton).toBeDefined()
    await zoomInButton!.trigger('mousedown')

    expect(mockExecute).toHaveBeenCalledWith('Comfy.Canvas.ZoomIn')
  })

  it('should execute zoom out command when zoom out button is clicked', async () => {
    mockExecute.mockClear()
    const wrapper = createWrapper()

    const buttons = wrapper.findAll('button')
    const zoomOutButton = buttons.find((btn) =>
      btn.text().includes('graphCanvasMenu.zoomOut')
    )

    expect(zoomOutButton).toBeDefined()
    await zoomOutButton!.trigger('mousedown')

    expect(mockExecute).toHaveBeenCalledWith('Comfy.Canvas.ZoomOut')
  })

  it('should execute fit view command when fit view button is clicked', async () => {
    mockExecute.mockClear()
    const wrapper = createWrapper()

    const buttons = wrapper.findAll('button')
    const fitViewButton = buttons.find((btn) =>
      btn.text().includes('zoomControls.zoomToFit')
    )

    expect(fitViewButton).toBeDefined()
    await fitViewButton!.trigger('click')

    expect(mockExecute).toHaveBeenCalledWith('Comfy.Canvas.FitView')
  })

  it('should emit close when minimap toggle button is clicked', async () => {
    mockExecute.mockClear()
    const wrapper = createWrapper()

    const minimapButton = wrapper.find('[data-testid="toggle-minimap-button"]')
    expect(minimapButton.exists()).toBe(true)

    await minimapButton.trigger('click')

    expect(mockExecute).toHaveBeenCalledWith('Comfy.Canvas.ToggleMinimap')
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('should not emit close when other command buttons are clicked', async () => {
    mockExecute.mockClear()
    const wrapper = createWrapper()

    const buttons = wrapper.findAll('button')
    const fitViewButton = buttons.find((btn) =>
      btn.text().includes('zoomControls.zoomToFit')
    )

    expect(fitViewButton).toBeDefined()
    await fitViewButton!.trigger('click')

    expect(mockExecute).toHaveBeenCalledWith('Comfy.Canvas.FitView')
    expect(wrapper.emitted('close')).toBeFalsy()
  })

  it('should call setAppZoomFromPercentage with valid zoom input values', async () => {
    mockSetAppZoom.mockClear()
    const wrapper = createWrapper()

    const input = wrapper.find('input[type="text"]')
    expect(input.exists()).toBe(true)

    await input.setValue('150')
    await input.trigger('input')

    expect(mockSetAppZoom).toHaveBeenCalledWith(150)
  })

  it('should not call setAppZoomFromPercentage with invalid zoom input values', async () => {
    mockSetAppZoom.mockClear()
    const wrapper = createWrapper()

    const input = wrapper.find('input[type="text"]')
    expect(input.exists()).toBe(true)

    // Test out of range values
    await input.setValue('0')
    await input.trigger('input')
    expect(mockSetAppZoom).not.toHaveBeenCalled()

    await input.setValue('1001')
    await input.trigger('input')
    expect(mockSetAppZoom).not.toHaveBeenCalled()
  })

  it('should display "Hide Minimap" when minimap is visible', () => {
    mockSettingGet.mockReturnValue(true)
    const wrapper = createWrapper()

    const minimapButton = wrapper.find('[data-testid="toggle-minimap-button"]')
    expect(minimapButton.text()).toContain('zoomControls.hideMinimap')
  })

  it('should display "Show Minimap" when minimap is hidden', () => {
    mockSettingGet.mockReturnValue(false)
    const wrapper = createWrapper()

    const minimapButton = wrapper.find('[data-testid="toggle-minimap-button"]')
    expect(minimapButton.text()).toContain('zoomControls.showMinimap')
  })

  it('should display keyboard shortcuts for commands', () => {
    const wrapper = createWrapper()

    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThan(0)

    // Each command button should show the keyboard shortcut
    expect(mockFormatKeySequence).toHaveBeenCalled()
  })

  it('should not be visible when visible prop is false', () => {
    const wrapper = createWrapper({ visible: false })

    expect(wrapper.find('.absolute').exists()).toBe(false)
  })

  it('should apply minimap container styles', () => {
    const wrapper = createWrapper()

    const container = wrapper.find('.bg-white')
    expect(container.exists()).toBe(true)

    // The component should apply the filtered minimap styles
    const style = container.attributes('style')
    expect(style).toContain('background-color')
  })
})
