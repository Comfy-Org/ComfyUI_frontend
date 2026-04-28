import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import ElectronDownloadProgress from './ElectronDownloadProgress.vue'
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
        pending: 'Starting',
        inProgress: 'In Progress',
        pause: 'Pause Download',
        paused: 'Paused',
        resume: 'Resume Download',
        cancel: 'Cancel Download',
        completed: 'Complete',
        failed: 'Download failed',
        cancelledNotice: 'Download cancelled'
      }
    }
  },
  missingWarn: false,
  fallbackWarn: false
})

function renderProgress(
  props: Partial<{
    download: ElectronDownload
    fileSize: number | null
  }> = {}
) {
  const download: ElectronDownload = props.download ?? {
    url: 'https://civitai.com/api/download/models/1',
    filename: 'wan_2.1_vae.safetensors',
    savePath: '/models/vae/wan_2.1_vae.safetensors',
    progress: 0.25,
    status: DownloadStatus.IN_PROGRESS
  }

  return render(ElectronDownloadProgress, {
    props: {
      download,
      fileSize: props.fileSize
    },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), PrimeVue, i18n]
    }
  })
}

describe('ElectronDownloadProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the known model size while the download is in progress', () => {
    renderProgress({ fileSize: 242 * 1024 * 1024 })

    expect(screen.getByText('wan_2.1_vae.safetensors')).toBeVisible()
    expect(screen.getByText('242 MB')).toBeVisible()
    expect(screen.getByText('In Progress · 25%')).toBeVisible()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '25'
    )
  })

  it('omits the size badge when the model size is unknown', () => {
    renderProgress({ fileSize: null })

    expect(screen.queryByText('242 MB')).not.toBeInTheDocument()
  })

  it('renders pending as indeterminate progress', () => {
    renderProgress({
      download: {
        url: 'https://civitai.com/api/download/models/2',
        filename: 'model.safetensors',
        progress: 0,
        status: DownloadStatus.PENDING
      }
    })

    expect(screen.getByText('Starting')).toBeVisible()
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
  })

  it('renders paused downloads with a resume action', () => {
    renderProgress({
      download: {
        url: 'https://civitai.com/api/download/models/3',
        filename: 'model.safetensors',
        progress: 0.5,
        status: DownloadStatus.PAUSED
      }
    })

    expect(screen.getByText('Paused · 50%')).toBeVisible()
    expect(screen.getByRole('progressbar')).toHaveAccessibleName('Paused')
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50'
    )
    expect(
      screen.getByRole('button', { name: 'Resume Download' })
    ).toBeVisible()
  })

  it('renders completed downloads as complete progress', () => {
    renderProgress({
      download: {
        url: 'https://civitai.com/api/download/models/4',
        filename: 'model.safetensors',
        progress: 0.99,
        status: DownloadStatus.COMPLETED
      }
    })

    expect(screen.getByText('Complete')).toBeVisible()
    expect(screen.getByRole('progressbar')).toHaveAccessibleName('Complete')
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '100'
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('forwards pause clicks to the download store', async () => {
    const user = userEvent.setup()
    renderProgress()
    const store = useElectronDownloadStore()
    const pauseSpy = vi
      .spyOn(store, 'pause')
      .mockImplementation(() => Promise.resolve())

    await user.click(screen.getByRole('button', { name: 'Pause Download' }))

    expect(pauseSpy).toHaveBeenCalledWith(
      'https://civitai.com/api/download/models/1'
    )
  })
})
