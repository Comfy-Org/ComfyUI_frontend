import { render, screen } from '@testing-library/vue'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { DownloadStatus } from '@comfyorg/comfyui-electron-types'

import type { ElectronDownload } from '@/stores/electronDownloadStore'

import DownloadItem from './DownloadItem.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { remove: 'Remove' },
      electronFileDownload: {
        cancelled: 'Cancelled',
        pause: 'Pause',
        resume: 'Resume',
        cancel: 'Cancel'
      }
    }
  }
})

function renderDownloadItem(download: ElectronDownload) {
  return render(DownloadItem, {
    props: { download },
    global: {
      plugins: [createTestingPinia(), i18n],
      stubs: {
        ProgressBar: true
      }
    }
  })
}

describe('DownloadItem', () => {
  it('shows cancelled tag with remove button for cancelled downloads', () => {
    renderDownloadItem({
      url: 'http://example.com/model.bin',
      filename: 'model.bin',
      savePath: '/models/checkpoints/model.bin',
      status: DownloadStatus.CANCELLED
    })

    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('shows cancelled tag for error downloads', () => {
    renderDownloadItem({
      url: 'http://example.com/model.bin',
      filename: 'model.bin',
      savePath: '/models/checkpoints/model.bin',
      status: DownloadStatus.ERROR
    })

    expect(screen.getByText('Cancelled')).toBeInTheDocument()
  })

  it('does not show cancelled tag for in-progress downloads', () => {
    renderDownloadItem({
      url: 'http://example.com/model.bin',
      filename: 'model.bin',
      savePath: '/models/checkpoints/model.bin',
      status: DownloadStatus.IN_PROGRESS,
      progress: 0.5
    })

    expect(screen.queryByText('Cancelled')).not.toBeInTheDocument()
  })

  it('displays file path label', () => {
    renderDownloadItem({
      url: 'http://example.com/model.bin',
      filename: 'model.bin',
      savePath: '/models/checkpoints/model.bin',
      status: DownloadStatus.CANCELLED
    })

    expect(screen.getByText('checkpoints/model.bin')).toBeInTheDocument()
  })
})
