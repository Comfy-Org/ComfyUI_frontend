/* eslint-disable testing-library/no-container, testing-library/no-node-access -- hidden file input has no role/label, queried by selector */
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import HDRIControls from '@/components/load3d/controls/HDRIControls.vue'
import type { HDRIConfig } from '@/extensions/core/load3d/interfaces'

const addAlert = vi.fn()
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ addAlert })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      load3d: {
        hdri: {
          label: 'HDRI',
          uploadFile: 'Upload HDRI',
          changeFile: 'Change HDRI',
          showAsBackground: 'Show as background',
          removeFile: 'Remove HDRI'
        }
      },
      toastMessages: { unsupportedHDRIFormat: 'Unsupported HDRI format' }
    }
  }
})

const defaultConfig: HDRIConfig = {
  enabled: false,
  hdriPath: '',
  showAsBackground: false,
  intensity: 1
}

type RenderOpts = {
  config?: HDRIConfig
  hasBackgroundImage?: boolean
  onUpdateHdriFile?: (file: File | null) => void
}

function renderComponent(opts: RenderOpts = {}) {
  const config = ref<HDRIConfig>(opts.config ?? { ...defaultConfig })

  const utils = render(HDRIControls, {
    props: {
      hdriConfig: config.value,
      'onUpdate:hdriConfig': (v: HDRIConfig | undefined) => {
        if (v) config.value = v
      },
      hasBackgroundImage: opts.hasBackgroundImage ?? false,
      onUpdateHdriFile: opts.onUpdateHdriFile
    },
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })

  return { ...utils, config, user: userEvent.setup() }
}

describe('HDRIControls', () => {
  beforeEach(() => {
    addAlert.mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('initial render', () => {
    it('renders the upload button when no HDRI is loaded', () => {
      renderComponent()

      expect(
        screen.getByRole('button', { name: 'Upload HDRI' })
      ).toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: 'HDRI' })
      ).not.toBeInTheDocument()
    })

    it('renders the change / toggle / show-as-bg / remove buttons when an HDRI is loaded', () => {
      renderComponent({
        config: { ...defaultConfig, hdriPath: '/api/hdri/test.hdr' }
      })

      expect(
        screen.getByRole('button', { name: 'Change HDRI' })
      ).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'HDRI' })).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Show as background' })
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Remove HDRI' })
      ).toBeInTheDocument()
    })

    it('hides the entire control when a background image is set and no HDRI is loaded', () => {
      const { container } = renderComponent({
        hasBackgroundImage: true,
        config: { ...defaultConfig, hdriPath: '' }
      })

      expect(container.querySelector('button')).toBeNull()
    })

    it('still renders when a background image is set but an HDRI is loaded', () => {
      renderComponent({
        hasBackgroundImage: true,
        config: { ...defaultConfig, hdriPath: '/api/hdri/test.hdr' }
      })

      expect(
        screen.getByRole('button', { name: 'Change HDRI' })
      ).toBeInTheDocument()
    })
  })

  describe('toggle buttons', () => {
    it('flips enabled in the v-model when the HDRI button is clicked', async () => {
      const { user, config } = renderComponent({
        config: { ...defaultConfig, hdriPath: '/api/hdri/test.hdr' }
      })

      await user.click(screen.getByRole('button', { name: 'HDRI' }))

      expect(config.value.enabled).toBe(true)
    })

    it('flips showAsBackground in the v-model when the show-as-background button is clicked', async () => {
      const { user, config } = renderComponent({
        config: { ...defaultConfig, hdriPath: '/api/hdri/test.hdr' }
      })

      await user.click(
        screen.getByRole('button', { name: 'Show as background' })
      )

      expect(config.value.showAsBackground).toBe(true)
    })
  })

  describe('file events', () => {
    it('emits updateHdriFile(null) when the remove button is clicked', async () => {
      const onUpdateHdriFile = vi.fn()
      const { user } = renderComponent({
        config: { ...defaultConfig, hdriPath: '/api/hdri/test.hdr' },
        onUpdateHdriFile
      })

      await user.click(screen.getByRole('button', { name: 'Remove HDRI' }))

      expect(onUpdateHdriFile).toHaveBeenCalledWith(null)
    })

    it('emits updateHdriFile with the picked file when its extension is supported', async () => {
      const onUpdateHdriFile = vi.fn()
      const { container } = renderComponent({ onUpdateHdriFile })

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      const file = new File(['hdri-data'], 'sky.hdr', {
        type: 'application/octet-stream'
      })
      Object.defineProperty(fileInput, 'files', { value: [file] })
      fileInput.dispatchEvent(new Event('change'))

      expect(onUpdateHdriFile).toHaveBeenCalledWith(file)
      expect(addAlert).not.toHaveBeenCalled()
    })

    it('rejects unsupported file extensions with a toast and no emit', async () => {
      const onUpdateHdriFile = vi.fn()
      const { container } = renderComponent({ onUpdateHdriFile })

      const fileInput = container.querySelector(
        'input[type="file"]'
      ) as HTMLInputElement
      const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
      Object.defineProperty(fileInput, 'files', { value: [file] })
      fileInput.dispatchEvent(new Event('change'))

      expect(onUpdateHdriFile).not.toHaveBeenCalled()
      expect(addAlert).toHaveBeenCalledWith('Unsupported HDRI format')
    })
  })
})
