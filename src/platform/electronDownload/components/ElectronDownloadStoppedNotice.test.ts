import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ElectronDownloadStoppedNotice from './ElectronDownloadStoppedNotice.vue'
import { useElectronDownloadStore } from '@/platform/electronDownload/electronDownloadStore'
import type { ElectronDownload } from '@/platform/electronDownload/electronDownloadStore'

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false,
  isDesktop: false
}))

vi.mock('@/utils/envUtil', () => ({
  electronAPI: () => ({ DownloadManager: undefined })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      electronFileDownload: {
        retry: 'Retry',
        dismiss: 'Dismiss',
        failed: 'Download failed',
        cancelledNotice: 'Download cancelled'
      }
    }
  },
  missingWarn: false,
  fallbackWarn: false
})

function renderNotice(
  props: Partial<{
    download: ElectronDownload
    showRetry: boolean
  }> = {}
) {
  const download: ElectronDownload = props.download ?? {
    url: 'https://civitai.com/api/download/models/1',
    filename: 'wan_2.1_vae.safetensors',
    status: DownloadStatus.ERROR,
    message: 'Network failed'
  }

  return render(ElectronDownloadStoppedNotice, {
    props: {
      download,
      showRetry: props.showRetry
    },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), PrimeVue, i18n]
    }
  })
}

describe('ElectronDownloadStoppedNotice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders an error alert and emits retry', async () => {
    const user = userEvent.setup()
    const { emitted } = renderNotice()

    expect(screen.getByRole('alert')).toBeVisible()
    expect(screen.getByText('Network failed')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(emitted().retry).toHaveLength(1)
  })

  it('falls back to the generic error message when none is provided', () => {
    renderNotice({
      download: {
        url: 'https://civitai.com/api/download/models/2',
        filename: 'wan_2.1_vae.safetensors',
        status: DownloadStatus.ERROR
      }
    })

    expect(screen.getByText('Download failed')).toBeVisible()
  })

  it('renders a cancelled status and dismisses the download', async () => {
    const user = userEvent.setup()
    renderNotice({
      download: {
        url: 'https://civitai.com/api/download/models/3',
        filename: 'wan_2.1_vae.safetensors',
        status: DownloadStatus.CANCELLED
      }
    })
    const store = useElectronDownloadStore()
    const removeSpy = vi.spyOn(store, 'remove').mockImplementation(() => {})

    expect(screen.getByRole('status')).toBeVisible()
    expect(screen.getByText('Download cancelled')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(removeSpy).toHaveBeenCalledWith(
      'https://civitai.com/api/download/models/3'
    )
  })

  it('can hide retry when the parent only supports dismiss', () => {
    renderNotice({ showRetry: false })

    expect(
      screen.queryByRole('button', { name: 'Retry' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeVisible()
  })
})
