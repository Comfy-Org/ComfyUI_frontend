import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import ViewerLightControls from '@/components/load3d/controls/viewer/ViewerLightControls.vue'

const settingValues: Record<string, unknown> = {
  'Comfy.Load3D.LightIntensityMaximum': 10,
  'Comfy.Load3D.LightIntensityMinimum': 1,
  'Comfy.Load3D.LightAdjustmentIncrement': 0.5
}

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => settingValues[key]
  })
}))

vi.mock('@/components/ui/slider/Slider.vue', () => ({
  default: {
    name: 'UiSlider',
    props: ['modelValue', 'min', 'max', 'step'],
    emits: ['update:modelValue'],
    template: `
      <input
        type="range"
        role="slider"
        :value="Array.isArray(modelValue) ? modelValue[0] : modelValue"
        :min="min"
        :max="max"
        :step="step"
        @input="$emit('update:modelValue', [Number($event.target.value)])"
      />
    `
  }
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { load3d: { lightIntensity: 'Light intensity' } }
  }
})

function renderComponent(initial = 5) {
  const intensity = ref<number>(initial)
  const utils = render(ViewerLightControls, {
    props: {
      lightIntensity: intensity.value,
      'onUpdate:lightIntensity': (v: number | undefined) => {
        if (v !== undefined) intensity.value = v
      }
    },
    global: { plugins: [i18n] }
  })
  return { ...utils, intensity }
}

describe('ViewerLightControls', () => {
  it('renders the localized label and a slider bound to lightIntensity', () => {
    renderComponent(7)

    expect(screen.getByText('Light intensity')).toBeInTheDocument()
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.value).toBe('7')
  })

  it('forwards the min / max / step settings from the setting store onto the slider', () => {
    renderComponent()
    const slider = screen.getByRole('slider') as HTMLInputElement

    expect(slider.min).toBe('1')
    expect(slider.max).toBe('10')
    expect(slider.step).toBe('0.5')
  })

  it('updates the v-model when the slider value changes', async () => {
    const { intensity } = renderComponent(5)
    const slider = screen.getByRole('slider') as HTMLInputElement

    slider.value = '8'
    slider.dispatchEvent(new Event('input', { bubbles: true }))

    expect(intensity.value).toBe(8)
  })
})
