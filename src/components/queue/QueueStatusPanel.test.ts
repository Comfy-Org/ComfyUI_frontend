import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import QueueStatusPanel from '@/components/queue/QueueStatusPanel.vue'

import type { JobView } from './queueStatusTypes'

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
        goToHistoryShort: 'History',
        nothingRunning: 'Nothing running yet',
        activeGenerations: 'Active generations',
        upgrade: 'Upgrade',
        planLimitRuns: 'Your plan runs {limit} at a time',
        planLimitFull: "Your plan's run limit is full",
        removeFromQueue: 'Remove {title} from the queue'
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

const held = (id: string, heldBy: JobView['heldBy']): JobView => ({
  ...job(id, 'held'),
  heldBy
})

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

  it('names the card for assistive tech without a visible title', () => {
    renderPanel()
    const region = screen.getByRole('region', { name: 'Active generations' })
    expect(region).toBe(screen.getByTestId('queue-status-panel'))
    expect(screen.queryByText('Active generations')).toBeNull()
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

  it('marks Clear queue with an X and Cancel all with the stop square', () => {
    renderPanel({
      rows: [
        { job: job('a', 'running'), subtitle: '64%' },
        { job: job('b', 'queued'), subtitle: 'Queued · next up' }
      ],
      queuedCount: 1
    })
    expect(screen.getByTestId('queue-status-clear-queue')).toContainElement(
      screen.getByTestId('queue-status-clear-queue-icon')
    )
    expect(screen.getByTestId('queue-status-clear-queue-icon')).toHaveClass(
      'icon-[lucide--x]'
    )
    const square = screen.getByTestId('queue-status-cancel-all-icon')
    expect(screen.getByTestId('queue-status-cancel-all')).toContainElement(
      square
    )
    expect(square).toHaveClass('bg-current')
    for (const testId of [
      'queue-status-clear-queue',
      'queue-status-cancel-all'
    ])
      expect(screen.getByTestId(testId)).toHaveAttribute(
        'data-variant',
        'muted-textonly'
      )
  })

  it('notes the plan limit once, above the first plan-held row', async () => {
    const user = userEvent.setup()
    const { emitted } = renderPanel({
      rows: [
        { job: job('a', 'running'), subtitle: '64%' },
        { job: held('b', 'plan'), subtitle: 'Waiting' },
        { job: held('c', 'plan'), subtitle: 'Waiting' }
      ],
      planRunLimit: 2
    })
    const notes = screen.getAllByTestId('queue-status-plan-limit-note')
    expect(notes).toHaveLength(1)
    expect(notes[0]).toHaveTextContent('Your plan runs 2 at a time')
    const order = screen
      .getAllByTestId(/^queue-status-(row|plan-limit-note)$/)
      .map((el) => el.dataset.status ?? 'note')
    expect(order).toEqual(['running', 'note', 'held', 'held'])
    expect(
      screen.getAllByRole('button', { name: /^Remove . from the queue$/ })
    ).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Upgrade' }))
    expect(emitted('upgrade')).toHaveLength(1)
  })

  it('falls back to a generic note without a known plan limit', () => {
    renderPanel({ rows: [{ job: held('b', 'plan'), subtitle: 'Waiting' }] })
    expect(
      screen.getByTestId('queue-status-plan-limit-note')
    ).toHaveTextContent("Your plan's run limit is full")
  })

  it.for(['partner', 'provider'] as const)(
    'shows no plan note when only the %s limit holds runs',
    (heldBy) => {
      renderPanel({
        rows: [
          { job: job('a', 'running'), subtitle: '64%' },
          { job: held('b', heldBy), subtitle: 'Waiting' }
        ]
      })
      expect(screen.queryByTestId('queue-status-plan-limit-note')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Upgrade' })).toBeNull()
    }
  )

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

  it('keeps the footer outside the scrolling row list', () => {
    renderPanel({
      rows: [
        { job: job('a', 'running'), subtitle: '64%' },
        { job: job('b', 'queued'), subtitle: 'Queued · next up' }
      ],
      queuedCount: 1
    })
    const list = screen.getByTestId('queue-status-panel-rows')
    expect(list.className).toContain('overflow-y-auto')
    expect(list.className).toMatch(/max-h-/)
    expect(list).not.toContainElement(
      screen.getByTestId('queue-status-panel-history')
    )
    expect(list).not.toContainElement(
      screen.getByTestId('queue-status-cancel-all')
    )
    expect(screen.getAllByTestId('queue-status-row')).toHaveLength(2)
  })

  it('separates the footer from the run list with a divider', () => {
    renderPanel({
      rows: [{ job: job('a', 'running'), subtitle: '64%' }],
      queuedCount: 0
    })
    const footer = screen.getByTestId('queue-status-panel-footer')
    expect(footer.className).toContain('border-t')
    expect(footer).toContainElement(
      screen.getByTestId('queue-status-panel-history')
    )
  })

  it('opens the history from the card while runs are active', async () => {
    const user = userEvent.setup()
    const { emitted } = renderPanel()
    await user.click(screen.getByTestId('queue-status-panel-history'))
    expect(emitted('history')).toHaveLength(1)
  })
})
