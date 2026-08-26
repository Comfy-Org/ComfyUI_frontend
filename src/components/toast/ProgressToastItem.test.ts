import { render, screen } from '@testing-library/vue'
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
    render(ProgressToastItem, {
      props: { job: completedJob() },
      global: { plugins: [i18n] }
    })

    const badge = screen.getByText('Finished')
    // eslint-disable-next-line testing-library/no-node-access -- verifying structural placement of opacity-50 boundary, which is the subject of this fix
    expect(badge.closest('.opacity-50')).toBeNull()

    const assetName = screen.getByText('controlnet-canny.safetensors')
    // eslint-disable-next-line testing-library/no-node-access -- verifying structural placement of opacity-50 boundary, which is the subject of this fix
    expect(assetName.closest('.opacity-50')).not.toBeNull()
  })
})
