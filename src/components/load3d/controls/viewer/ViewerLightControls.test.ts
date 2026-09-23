import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import ViewerLightControls from '@/components/load3d/controls/viewer/ViewerLightControls.vue'
import { useSettingStore } from '@/platform/settings/settingStore'

beforeEach(() => {
  useSettingStore().$patch({ settingValues })
})

const settingValues: Record<string, unknown> = {
  'Comfy.Load3D.LightIntensityMaximum': 10,
  'Comfy.Load3D.LightIntensityMinimum': 1,
  'Comfy.Load3D.LightAdjustmentIncrement': 0.5
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { load3d: { lightIntensity: 'Light intensity' } }
  }
})

function renderComponent(initial = 5) {
  const intensity = ref<number>(initial)
  const utils = render(
    defineComponent({
      setup: () => () =>
        h(ViewerLightControls, {
          lightIntensity: intensity.value,
          'onUpdate:lightIntensity': (v: number | undefined) => {
            if (v !== undefined) intensity.value = v
          }
        })
    }),
    {
      global: { plugins: [i18n] }
    }
  )
  return { ...utils, intensity }
}

describe('ViewerLightControls', () => {
  it('renders the localized label and a slider bound to lightIntensity', async () => {
    renderComponent(7)

    expect(screen.getByText('Light intensity')).toBeInTheDocument()
    expect(await screen.findByRole('slider')).toHaveAttribute(
      'aria-valuenow',
      '7'
    )
  })

  it('applies the configured range and increment', async () => {
    const user = userEvent.setup()
    renderComponent()
    const slider = await screen.findByRole('slider')

    expect(slider).toHaveAttribute('aria-valuemin', '1')
    expect(slider).toHaveAttribute('aria-valuemax', '10')
    slider.focus()
    await user.keyboard('{ArrowRight}')
    expect(slider).toHaveAttribute('aria-valuenow', '5.5')
  })

  it('updates the v-model when the slider value changes', async () => {
    const user = userEvent.setup()
    const { intensity } = renderComponent(5)
    const slider = await screen.findByRole('slider')
    slider.focus()
    await user.keyboard('{ArrowRight>6}')

    expect(intensity.value).toBe(8)
  })
})
