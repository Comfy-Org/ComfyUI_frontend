import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import QueueStatusPanel from '@/components/queue/QueueStatusPanel.vue'
import type { JobListItem } from '@/composables/queue/useJobList'

import type { JobView, RecentResult } from './queueStatusTypes'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      queueStatus: {
        cancel: 'Stop this run',
        clearQueue: 'Clear queue',
        cancelAll: 'Cancel all',
        recentResults: 'Recent results',
        resultsCount: 'Results ({count})',
        goToHistoryShort: 'Go to history',
        nothingRunning: 'Nothing running yet',
        activeGenerations: 'Active generations'
      }
    }
  }
})

const job = (id: string, status: JobView['status']): JobView => ({
  id,
  title: id,
  status,
  progress: 0,
  queuePosition: status === 'queued' ? 1 : 0
})

const historyJob: JobListItem = {
  id: 'h1',
  title: 'h1',
  meta: '',
  state: 'completed'
}

const result: RecentResult = {
  id: 'h1',
  job: historyJob,
  name: 'ComfyUI_00001_.png',
  meta: 'Completed · 2:43 PM',
  isVideo: false
}

function renderPanel(
  props: Partial<InstanceType<typeof QueueStatusPanel>['$props']> = {}
) {
  return render(QueueStatusPanel, {
    props: {
      rows: [{ job: job('a', 'running'), subtitle: '64%' }],
      queuedCount: 0,
      ...props
    },
    global: { plugins: [i18n] }
  })
}

describe('QueueStatusPanel', () => {
  it('emits cancel for the row that was stopped', async () => {
    const user = userEvent.setup()
    const { emitted } = renderPanel()
    await user.click(screen.getByTestId('queue-status-row-cancel'))
    expect(emitted('cancel')[0]).toEqual([expect.objectContaining({ id: 'a' })])
  })

  it('hides the bulk actions for a single job', () => {
    renderPanel()
    expect(screen.queryByTestId('queue-status-cancel-all')).toBeNull()
  })

  it('offers Clear queue only when something is queued', () => {
    renderPanel({
      rows: [
        { job: job('a', 'running'), subtitle: '64%' },
        { job: job('b', 'running'), subtitle: '12%' }
      ]
    })
    expect(screen.getByTestId('queue-status-cancel-all')).toBeTruthy()
    expect(screen.queryByTestId('queue-status-clear-queue')).toBeNull()
  })

  it('emits clearQueue and cancelAll from the footer', async () => {
    const user = userEvent.setup()
    const { emitted } = renderPanel({
      rows: [
        { job: job('a', 'running'), subtitle: '64%' },
        { job: job('b', 'queued'), subtitle: 'Queued · next up' }
      ],
      queuedCount: 1
    })
    await user.click(screen.getByTestId('queue-status-clear-queue'))
    await user.click(screen.getByTestId('queue-status-cancel-all'))
    expect(emitted('clearQueue')).toHaveLength(1)
    expect(emitted('cancelAll')).toHaveLength(1)
  })

  it('does not count a failed row toward Cancel all', () => {
    renderPanel({
      rows: [
        { job: job('a', 'running'), subtitle: '64%' },
        { job: job('b', 'failed'), subtitle: 'Failed' }
      ]
    })
    expect(screen.queryByTestId('queue-status-cancel-all')).toBeNull()
  })

  it('opens history from a failed row', async () => {
    const user = userEvent.setup()
    const { emitted } = renderPanel({
      rows: [{ job: job('b', 'failed'), subtitle: 'Failed' }]
    })
    await user.click(screen.getByTestId('queue-status-row-details'))
    expect(emitted('history')).toHaveLength(1)
  })
})
