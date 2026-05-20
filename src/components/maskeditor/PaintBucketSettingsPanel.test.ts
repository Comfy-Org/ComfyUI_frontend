import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import PaintBucketSettingsPanel from '@/components/maskeditor/PaintBucketSettingsPanel.vue'

const mockStore = vi.hoisted(() => ({
  paintBucketTolerance: 5,
  fillOpacity: 100,
  setPaintBucketTolerance: vi.fn(),
  setFillOpacity: vi.fn()
}))

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: () => mockStore
}))

vi.mock('@/components/maskeditor/controls/SliderControl.vue', () => ({
  default: {
    name: 'SliderControlStub',
    props: ['label', 'min', 'max', 'step', 'modelValue'],
    emits: ['update:modelValue'],
    template: `<button :aria-label="label" @click="$emit('update:modelValue', 42)">{{ modelValue }}</button>`
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      maskEditor: {
        paintBucketSettings: 'Paint Bucket Settings',
        tolerance: 'Tolerance',
        fillOpacity: 'Fill Opacity'
      }
    }
  }
})

const renderPanel = () =>
  render(PaintBucketSettingsPanel, { global: { plugins: [i18n] } })

describe('PaintBucketSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.paintBucketTolerance = 5
    mockStore.fillOpacity = 100
  })

  it('should bind tolerance slider to store value', () => {
    mockStore.paintBucketTolerance = 87
    renderPanel()

    expect(
      screen.getByRole('button', { name: 'Tolerance' }).textContent
    ).toContain('87')
  })

  it('should bind fill opacity slider to store value', () => {
    mockStore.fillOpacity = 33
    renderPanel()

    expect(
      screen.getByRole('button', { name: 'Fill Opacity' }).textContent
    ).toContain('33')
  })

  it('should call setPaintBucketTolerance when tolerance slider emits', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Tolerance' }))

    expect(mockStore.setPaintBucketTolerance).toHaveBeenCalledWith(42)
  })

  it('should call setFillOpacity when fill opacity slider emits', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Fill Opacity' }))

    expect(mockStore.setFillOpacity).toHaveBeenCalledWith(42)
  })
})
