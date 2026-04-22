import { render } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { AssetDownload } from '@/stores/assetDownloadStore'

import ProgressToastItem from './ProgressToastItem.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      progressToast: {
        finished: 'Finished',
        failed: 'Failed',
        pending: 'Pending'
      }
    }
  }
})

function completedJob(): AssetDownload {
  return {
    taskId: 'task-1',
    assetId: 'asset-1',
    assetName: 'controlnet-canny.safetensors',
    bytesTotal: 100,
    bytesDownloaded: 100,
    progress: 1,
    status: 'completed',
    lastUpdate: Date.now()
  }
}

describe('ProgressToastItem — completed state', () => {
  it('keeps the finished badge outside the dimmed (opacity-50) subtree', () => {
    const { container } = render(ProgressToastItem, {
      props: { job: completedJob() },
      global: { plugins: [i18n] }
    })

    const badge = container.querySelector<HTMLElement>(
      '[class*="rounded-full"]'
    )
    expect(badge).not.toBeNull()
    expect(badge!.closest('.opacity-50')).toBeNull()

    const dimmed = container.querySelector('.opacity-50')
    expect(dimmed).not.toBeNull()
    expect(dimmed!.textContent).toContain('controlnet-canny.safetensors')
  })
})
