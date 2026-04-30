import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ColorSelectSettingsPanel from '@/components/maskeditor/ColorSelectSettingsPanel.vue'
import { ColorComparisonMethod } from '@/extensions/core/maskeditor/types'

const mockStore = vi.hoisted(() => ({
  colorSelectTolerance: 20,
  selectionOpacity: 100,
  colorSelectLivePreview: false,
  applyWholeImage: false,
  colorComparisonMethod: 'simple' as ColorComparisonMethod,
  maskBoundary: false,
  maskTolerance: 0,
  setColorSelectTolerance: vi.fn(),
  setSelectionOpacity: vi.fn(),
  setMaskTolerance: vi.fn()
}))

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: () => mockStore
}))

vi.mock('@/components/maskeditor/controls/SliderControl.vue', () => ({
  default: {
    name: 'SliderControlStub',
    props: ['label', 'min', 'max', 'step', 'modelValue'],
    emits: ['update:modelValue'],
    template: `<button data-control="slider" :aria-label="label" @click="$emit('update:modelValue', 99)">{{ modelValue }}</button>`
  }
}))

vi.mock('@/components/maskeditor/controls/ToggleControl.vue', () => ({
  default: {
    name: 'ToggleControlStub',
    props: ['label', 'modelValue'],
    emits: ['update:modelValue'],
    template: `<button data-control="toggle" :aria-label="label" @click="$emit('update:modelValue', !modelValue)">{{ modelValue }}</button>`
  }
}))

vi.mock('@/components/maskeditor/controls/DropdownControl.vue', () => ({
  default: {
    name: 'DropdownControlStub',
    props: ['label', 'options', 'modelValue'],
    emits: ['update:modelValue'],
    template: `<button data-control="dropdown" :aria-label="label" @click="$emit('update:modelValue', 'lab')">{{ modelValue }}</button>`
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      maskEditor: {
        colorSelectSettings: 'Color Select Settings',
        tolerance: 'Tolerance',
        selectionOpacity: 'Selection Opacity',
        livePreview: 'Live Preview',
        applyToWholeImage: 'Apply to Whole Image',
        method: 'Method',
        stopAtMask: 'Stop at mask',
        maskTolerance: 'Mask Tolerance'
      }
    }
  }
})

const renderPanel = () =>
  render(ColorSelectSettingsPanel, { global: { plugins: [i18n] } })

describe('ColorSelectSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.colorSelectTolerance = 20
    mockStore.selectionOpacity = 100
    mockStore.colorSelectLivePreview = false
    mockStore.applyWholeImage = false
    mockStore.colorComparisonMethod = ColorComparisonMethod.Simple
    mockStore.maskBoundary = false
    mockStore.maskTolerance = 0
  })

  it('should call setColorSelectTolerance when tolerance slider emits', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Tolerance' }))

    expect(mockStore.setColorSelectTolerance).toHaveBeenCalledWith(99)
  })

  it('should call setSelectionOpacity when selection opacity slider emits', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Selection Opacity' }))

    expect(mockStore.setSelectionOpacity).toHaveBeenCalledWith(99)
  })

  it('should toggle colorSelectLivePreview when live preview toggle emits', async () => {
    const user = userEvent.setup()
    mockStore.colorSelectLivePreview = false
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Live Preview' }))

    expect(mockStore.colorSelectLivePreview).toBe(true)
  })

  it('should toggle applyWholeImage when whole-image toggle emits', async () => {
    const user = userEvent.setup()
    mockStore.applyWholeImage = false
    renderPanel()

    await user.click(
      screen.getByRole('button', { name: 'Apply to Whole Image' })
    )

    expect(mockStore.applyWholeImage).toBe(true)
  })

  it('should set comparison method when dropdown emits', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Method' }))

    expect(mockStore.colorComparisonMethod).toBe(ColorComparisonMethod.LAB)
  })

  it('should toggle maskBoundary when stop-at-mask toggle emits', async () => {
    const user = userEvent.setup()
    mockStore.maskBoundary = false
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Stop at mask' }))

    expect(mockStore.maskBoundary).toBe(true)
  })

  it('should call setMaskTolerance when mask tolerance slider emits', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Mask Tolerance' }))

    expect(mockStore.setMaskTolerance).toHaveBeenCalledWith(99)
  })

  it('should reflect store values on the controls', () => {
    mockStore.colorSelectTolerance = 77
    mockStore.colorComparisonMethod = ColorComparisonMethod.HSL

    renderPanel()

    expect(
      screen.getByRole('button', { name: 'Tolerance' }).textContent
    ).toContain('77')
    expect(
      screen.getByRole('button', { name: 'Method' }).textContent
    ).toContain('hsl')
  })
})
