import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { DownloadStatus } from '@comfyorg/comfyui-electron-types'

import { useElectronDownloadStore } from '@/stores/electronDownloadStore'
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
        cancel: 'Cancel',
        error: 'Error'
      }
    }
  }
})

function createDownload(
  status: DownloadStatus,
  url = 'http://example.com/model.bin'
): ElectronDownload {
  return {
    url,
    filename: 'model.bin',
    savePath: '/models/checkpoints/model.bin',
    status
  }
}

function renderDownloadItem(
  download: ElectronDownload,
  initialDownloads: ElectronDownload[] = []
) {
  const pinia = createTestingPinia({
    initialState: {
      downloads: { downloads: initialDownloads }
    }
  })

  const view = render(DownloadItem, {
    props: { download },
    global: {
      plugins: [pinia, i18n],
      stubs: {
        ProgressBar: true
      }
    }
  })

  return {
    ...view,
    electronDownloadStore: useElectronDownloadStore()
  }
}

describe('DownloadItem', () => {
  it('shows cancelled tag with remove button for cancelled downloads', () => {
    renderDownloadItem(createDownload(DownloadStatus.CANCELLED))

    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
  })

  it('removes cancelled downloads from the store', async () => {
    const user = userEvent.setup()
    const cancelledDownload = createDownload(DownloadStatus.CANCELLED)
    const pausedDownload = createDownload(
      DownloadStatus.PAUSED,
      'http://example.com/other-model.bin'
    )
    const { electronDownloadStore } = renderDownloadItem(cancelledDownload, [
      cancelledDownload,
      pausedDownload
    ])

    await user.click(screen.getByRole('button', { name: 'Remove' }))

    expect(electronDownloadStore.downloads).toEqual([pausedDownload])
  })

  it('shows error tag for error downloads', () => {
    renderDownloadItem(createDownload(DownloadStatus.ERROR))

    expect(screen.getByText('Error')).toBeInTheDocument()
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
    expect(screen.queryByText('Error')).not.toBeInTheDocument()
  })

  it('displays file path label', () => {
    renderDownloadItem(createDownload(DownloadStatus.CANCELLED))

    expect(screen.getByText('checkpoints/model.bin')).toBeInTheDocument()
  })
})
