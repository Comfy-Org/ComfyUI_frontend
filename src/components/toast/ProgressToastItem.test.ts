import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
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
      },
      electronFileDownload: {
        cancel: 'Cancel Download',
        cancelled: 'Cancelled'
      },
      g: { cancel: 'Cancel' }
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
    // oxlint-disable-next-line testing-library/no-node-access -- verifying structural placement of opacity-50 boundary, which is the subject of this fix
    expect(badge.closest('.opacity-50')).toBeNull()

    const assetName = screen.getByText('controlnet-canny.safetensors')
    // oxlint-disable-next-line testing-library/no-node-access -- verifying structural placement of opacity-50 boundary, which is the subject of this fix
    expect(assetName.closest('.opacity-50')).not.toBeNull()
  })
})

describe('ProgressToastItem — cancellation', () => {
  it('offers cancellation for running downloads', async () => {
    const user = userEvent.setup()
    const running = { ...completedJob(), status: 'running' as const }
    const { emitted } = render(ProgressToastItem, {
      props: { job: running },
      global: { plugins: [i18n] }
    })

    await user.click(screen.getByRole('button', { name: 'Cancel Download' }))
    expect(emitted().cancel).toEqual([['task-1']])
  })

  it('shows cancelled as terminal without another cancel button', () => {
    const cancelled = { ...completedJob(), status: 'cancelled' as const }
    render(ProgressToastItem, {
      props: { job: cancelled },
      global: { plugins: [i18n] }
    })

    expect(screen.getByText('Cancelled')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Cancel Download' })).toBeNull()
  })

  it('disables duplicate cancellation while the request is pending', () => {
    const running = { ...completedJob(), status: 'running' as const }
    render(ProgressToastItem, {
      props: { job: running, isCancelling: true },
      global: { plugins: [i18n] }
    })

    expect(
      screen.getByRole('button', { name: 'Cancel Download' })
    ).toBeDisabled()
  })
})
