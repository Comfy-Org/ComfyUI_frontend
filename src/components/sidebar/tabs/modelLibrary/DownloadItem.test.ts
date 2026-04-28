import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import { render, screen } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import PrimeVue from 'primevue/config'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import DownloadItem from './DownloadItem.vue'
import type { ElectronDownload } from '@/platform/electronDownload/electronDownloadStore'

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false,
  isDesktop: false
}))

vi.mock('@/utils/envUtil', () => ({
  electronAPI: () => ({ DownloadManager: undefined })
}))

vi.mock('@/platform/electronDownload/downloadFailureReporter', () => ({
  reportDownloadFailure: vi.fn()
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      electronFileDownload: {
        inProgress: 'In Progress',
        pause: 'Pause Download',
        paused: 'Paused',
        resume: 'Resume Download',
        cancel: 'Cancel Download',
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

function renderItem(download: ElectronDownload) {
  return render(DownloadItem, {
    props: { download },
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn }), PrimeVue, i18n]
    }
  })
}

describe('DownloadItem', () => {
  it('renders active downloads as progress', () => {
    renderItem({
      url: 'https://civitai.com/api/download/models/1',
      filename: 'model.safetensors',
      progress: 0.25,
      status: DownloadStatus.IN_PROGRESS
    })

    expect(screen.getByText('In Progress · 25%')).toBeVisible()
  })

  it('renders stopped downloads with a dismiss action', () => {
    renderItem({
      url: 'https://civitai.com/api/download/models/2',
      filename: 'model.safetensors',
      status: DownloadStatus.ERROR,
      message: 'Network failed'
    })

    expect(screen.getByText('Network failed')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Retry' })
    ).not.toBeInTheDocument()
  })
})
