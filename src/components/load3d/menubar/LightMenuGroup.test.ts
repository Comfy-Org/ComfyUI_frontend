import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import LightMenuGroup from '@/components/load3d/menubar/LightMenuGroup.vue'
import type { LightConfig } from '@/extensions/core/load3d/interfaces'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const settingValues: Record<string, number> = {
  'Comfy.Load3D.LightIntensityMinimum': 1,
  'Comfy.Load3D.LightIntensityMaximum': 10,
  'Comfy.Load3D.LightAdjustmentIncrement': 0.1
}

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: (key: string) => settingValues[key] })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderGroup(isOriginalMaterial: boolean) {
  const config: LightConfig = { intensity: 5 }
  return render(LightMenuGroup, {
    props: { config, isOriginalMaterial },
    global: { plugins: [i18n], directives: { tooltip: () => {} } }
  })
}

describe('LightMenuGroup', () => {
  it('shows the intensity control for the original material', () => {
    renderGroup(true)

    expect(
      screen.getByRole('button', { name: 'Intensity' })
    ).toBeInTheDocument()
  })

  it('explains intensity is unavailable for other materials', () => {
    renderGroup(false)

    expect(
      screen.queryByRole('button', { name: 'Intensity' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Original material only')).toBeInTheDocument()
  })

  it('drives HDRI intensity (0-5) when an HDRI environment is active', async () => {
    const config: LightConfig = {
      intensity: 5,
      hdri: {
        enabled: true,
        hdriPath: 'env.hdr',
        showAsBackground: false,
        intensity: 2
      }
    }
    render(LightMenuGroup, {
      props: { config, isOriginalMaterial: true },
      global: { plugins: [i18n], directives: { tooltip: () => {} } }
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Intensity' }))

    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-valuemax', '5')
    expect(slider).toHaveAttribute('aria-valuenow', '2')
  })
})
