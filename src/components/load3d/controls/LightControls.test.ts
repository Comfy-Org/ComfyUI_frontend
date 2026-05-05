import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import LightControls from '@/components/load3d/controls/LightControls.vue'
import type {
  HDRIConfig,
  MaterialMode
} from '@/extensions/core/load3d/interfaces'

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

vi.mock('@/composables/useDismissableOverlay', () => ({
  useDismissableOverlay: vi.fn()
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
  messages: { en: { load3d: { lightIntensity: 'Light intensity' } } }
})

type RenderOpts = {
  lightIntensity?: number
  materialMode?: MaterialMode
  hdriConfig?: HDRIConfig
  embedded?: boolean
}

function renderComponent(opts: RenderOpts = {}) {
  const lightIntensity = ref<number>(opts.lightIntensity ?? 5)
  const materialMode = ref<MaterialMode>(opts.materialMode ?? 'original')
  const hdriConfig = ref<HDRIConfig | undefined>(opts.hdriConfig)

  const utils = render(LightControls, {
    props: {
      lightIntensity: lightIntensity.value,
      'onUpdate:lightIntensity': (v: number | undefined) => {
        if (v !== undefined) lightIntensity.value = v
      },
      materialMode: materialMode.value,
      'onUpdate:materialMode': (v: MaterialMode | undefined) => {
        if (v) materialMode.value = v
      },
      hdriConfig: hdriConfig.value,
      'onUpdate:hdriConfig': (v: HDRIConfig | undefined) => {
        hdriConfig.value = v
      },
      embedded: opts.embedded ?? false
    },
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })

  return {
    ...utils,
    lightIntensity,
    hdriConfig,
    user: userEvent.setup()
  }
}

describe('LightControls', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('material mode gating', () => {
    it('renders the intensity control when materialMode is original', () => {
      renderComponent({ materialMode: 'original' })

      expect(
        screen.getByRole('button', { name: 'Light intensity' })
      ).toBeInTheDocument()
    })

    it.each(['normal', 'wireframe'] as const)(
      'hides the intensity control when materialMode is %s',
      (mode) => {
        renderComponent({ materialMode: mode })

        expect(
          screen.queryByRole('button', { name: 'Light intensity' })
        ).not.toBeInTheDocument()
      }
    )
  })

  describe('default (non-HDRI) mode', () => {
    it('feeds the slider with the setting-store min / max / step', async () => {
      const { user } = renderComponent({ lightIntensity: 5 })
      await user.click(screen.getByRole('button', { name: 'Light intensity' }))

      const slider = screen.getByRole('slider') as HTMLInputElement
      expect(slider.min).toBe('1')
      expect(slider.max).toBe('10')
      expect(slider.step).toBe('0.5')
    })

    it('updates lightIntensity v-model when the slider changes', async () => {
      const { user, lightIntensity } = renderComponent({ lightIntensity: 5 })
      await user.click(screen.getByRole('button', { name: 'Light intensity' }))

      const slider = screen.getByRole('slider') as HTMLInputElement
      slider.value = '7.5'
      slider.dispatchEvent(new Event('input', { bubbles: true }))

      expect(lightIntensity.value).toBe(7.5)
    })
  })

  describe('HDRI active mode', () => {
    const hdriConfig: HDRIConfig = {
      enabled: true,
      hdriPath: '/api/hdri/test.hdr',
      showAsBackground: false,
      intensity: 2
    }

    it('reads the slider min / max / step from the HDRI range (0..5 step 0.1)', async () => {
      const { user } = renderComponent({ hdriConfig })
      await user.click(screen.getByRole('button', { name: 'Light intensity' }))

      const slider = screen.getByRole('slider') as HTMLInputElement
      expect(slider.min).toBe('0')
      expect(slider.max).toBe('5')
      expect(slider.step).toBe('0.1')
    })

    it('writes back to hdriConfig.intensity instead of lightIntensity when the slider changes', async () => {
      const {
        user,
        lightIntensity,
        hdriConfig: cfg
      } = renderComponent({
        lightIntensity: 5,
        hdriConfig
      })
      await user.click(screen.getByRole('button', { name: 'Light intensity' }))

      const slider = screen.getByRole('slider') as HTMLInputElement
      slider.value = '3.5'
      slider.dispatchEvent(new Event('input', { bubbles: true }))

      expect(cfg.value?.intensity).toBe(3.5)
      expect(lightIntensity.value).toBe(5) // unchanged
    })
  })

  describe('embedded mode', () => {
    it('renders the slider inline without the trigger button when embedded is true', () => {
      renderComponent({ embedded: true })

      expect(
        screen.queryByRole('button', { name: 'Light intensity' })
      ).not.toBeInTheDocument()
      expect(screen.getByRole('slider')).toBeInTheDocument()
    })
  })
})
