import { DownloadStatus } from '@comfyorg/comfyui-electron-types'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import en from '@/locales/en/main.json'
import type { ElectronDownload } from '@/stores/electronDownloadStore'

import DownloadItem from './DownloadItem.vue'

describe('DownloadItem', () => {
  it('names download progress and shows the rounded percentage above ten percent', async () => {
    const download: ElectronDownload = {
      url: 'https://example.com/model.safetensors',
      filename: 'model.safetensors',
      savePath: '/models/checkpoints/model.safetensors',
      status: DownloadStatus.IN_PROGRESS,
      progress: 0.1
    }
    const { rerender } = render(DownloadItem, {
      props: { download },
      global: {
        directives: { tooltip: {} },
        plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })]
      }
    })

    const progress = screen.getByRole('progressbar', {
      name: 'checkpoints/model.safetensors'
    })
    expect(progress).toHaveAttribute('aria-valuenow', '10')
    expect(screen.queryByText('10%')).not.toBeInTheDocument()

    await rerender({ download: { ...download, progress: 0.1274 } })

    expect(progress).toHaveAttribute('aria-valuenow', '12.7')
    expect(screen.getByText('12.7%')).toBeInTheDocument()
  })
})
