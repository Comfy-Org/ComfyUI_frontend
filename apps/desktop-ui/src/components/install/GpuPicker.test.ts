import { render, screen } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

vi.mock('@/utils/envUtil', () => ({
  electronAPI: vi.fn(() => ({
    getPlatform: vi.fn().mockReturnValue('win32')
  }))
}))

vi.mock('@/i18n', () => ({
  t: (key: string) => key,
  te: () => false,
  st: (_key: string, fallback: string) => fallback
}))

import type { TorchDeviceType } from '@comfyorg/comfyui-electron-types'
import GpuPicker from '@/components/install/GpuPicker.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: { en: {} }
})

const HardwareOptionStub = {
  props: ['imagePath', 'placeholderText', 'subtitle', 'selected'],
  emits: ['click'],
  template:
    '<button :data-testid="placeholderText" :data-selected="selected" @click="$emit(\'click\')" >{{ placeholderText }}</button>'
}

function renderPicker(device: TorchDeviceType | null = null) {
  return render(GpuPicker, {
    props: { device },
    global: {
      plugins: [[PrimeVue, { unstyled: true }], i18n],
      stubs: {
        HardwareOption: HardwareOptionStub,
        Tag: {
          props: ['value'],
          template: '<span data-testid="recommended-tag">{{ value }}</span>'
        }
      }
    }
  })
}

describe('GpuPicker', () => {
  describe('recommended badge', () => {
    it('shows recommended badge for nvidia', () => {
      renderPicker('nvidia')
      expect(screen.getByTestId('recommended-tag')).toBeVisible()
    })

    it('shows recommended badge for amd', () => {
      renderPicker('amd')
      expect(screen.getByTestId('recommended-tag')).toBeVisible()
    })

    it('does not show recommended badge for cpu', () => {
      renderPicker('cpu')
      expect(screen.getByTestId('recommended-tag')).not.toBeVisible()
    })

    it('does not show recommended badge for unsupported', () => {
      renderPicker('unsupported')
      expect(screen.getByTestId('recommended-tag')).not.toBeVisible()
    })

    it('does not show recommended badge when no device is selected', () => {
      renderPicker(null)
      expect(screen.getByTestId('recommended-tag')).not.toBeVisible()
    })
  })

  describe('selection state', () => {
    it('marks nvidia as selected when device is nvidia', () => {
      renderPicker('nvidia')
      expect(screen.getByTestId('NVIDIA').dataset.selected).toBe('true')
    })

    it('marks cpu as selected when device is cpu', () => {
      renderPicker('cpu')
      expect(screen.getByTestId('CPU').dataset.selected).toBe('true')
    })

    it('marks unsupported as selected when device is unsupported', () => {
      renderPicker('unsupported')
      expect(screen.getByTestId('Manual Install').dataset.selected).toBe('true')
    })

    it('no option is selected when device is null', () => {
      renderPicker(null)
      expect(screen.getByTestId('CPU').dataset.selected).toBe('false')
      expect(screen.getByTestId('NVIDIA').dataset.selected).toBe('false')
    })
  })

  describe('gpu options on non-darwin platform', () => {
    it('shows NVIDIA, AMD, CPU, and Manual Install options', () => {
      renderPicker(null)
      expect(screen.getByTestId('NVIDIA')).toBeDefined()
      expect(screen.getByTestId('AMD')).toBeDefined()
      expect(screen.getByTestId('CPU')).toBeDefined()
      expect(screen.getByTestId('Manual Install')).toBeDefined()
    })
  })
})
