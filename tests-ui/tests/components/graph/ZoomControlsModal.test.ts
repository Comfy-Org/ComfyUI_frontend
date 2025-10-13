import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

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

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

// Mock dependencies

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
    vi.restoreAllMocks()
  })

  it('should execute zoom in command when zoom in button is clicked', async () => {
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
    const wrapper = createWrapper()

    const minimapButton = wrapper.find('[data-testid="toggle-minimap-button"]')
    expect(minimapButton.exists()).toBe(true)

    await minimapButton.trigger('click')

    expect(mockExecute).toHaveBeenCalledWith('Comfy.Canvas.ToggleMinimap')
    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('should not emit close when other command buttons are clicked', async () => {
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
    const wrapper = createWrapper()

    const inputNumber = wrapper.findComponent({ name: 'InputNumber' })
    expect(inputNumber.exists()).toBe(true)

    // Emit the input event with PrimeVue's InputNumberInputEvent structure
    await inputNumber.vm.$emit('input', { value: 150 })

    expect(mockSetAppZoom).toHaveBeenCalledWith(150)
  })

  it('should not call setAppZoomFromPercentage with invalid zoom input values', async () => {
    const wrapper = createWrapper()

    const inputNumber = wrapper.findComponent({ name: 'InputNumber' })
    expect(inputNumber.exists()).toBe(true)

    // Test out of range values
    await inputNumber.vm.$emit('input', { value: 0 })
    expect(mockSetAppZoom).not.toHaveBeenCalled()

    await inputNumber.vm.$emit('input', { value: 1001 })
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
})
