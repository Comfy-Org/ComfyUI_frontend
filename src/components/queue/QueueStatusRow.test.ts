import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import QueueStatusRow from '@/components/queue/QueueStatusRow.vue'

import type { JobView } from './queueStatusTypes'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      queueStatus: {
        cancel: 'Stop this run',
        details: 'Details',
        cancelRunTooltip: 'Cancel run',
        removeFromQueue: 'Remove {title} from the queue',
        removeFromQueueTooltip: 'Remove from queue'
      }
    }
  }
})

const job = (
  status: JobView['status'],
  progress = 0,
  heldBy?: JobView['heldBy']
): JobView => ({
  id: 'a',
  title: 'Seedance shot',
  status,
  progress,
  queuePosition: 0,
  heldBy
})

function renderRow(row: JobView, subtitle = '') {
  return render(QueueStatusRow, {
    props: { job: row, subtitle, delayMs: 0 },
    global: { plugins: [i18n] }
  })
}

describe('QueueStatusRow', () => {
  it('shows progress as a bar on the bottom edge while running', () => {
    renderRow(job('running', 40), '40% · 0:52')
    const bar = screen.getByTestId('queue-status-row-progress')
    expect(bar).toHaveStyle({ width: '40%' })
    expect(bar.className).toContain('bottom-0')
    expect(bar.className).toContain('left-0')
    expect(screen.getByTestId('queue-status-row')).toContainElement(bar)
    expect(screen.getByText('40% · 0:52')).toBeInTheDocument()
  })

  it('marks a running job with a static ring, not a spinner', () => {
    renderRow(job('running', 40))
    const icon = screen.getByTestId('queue-status-row-running-icon')
    expect(icon).toHaveClass('icon-[lucide--circle]')
    expect(icon).not.toHaveClass('animate-spin')
  })

  it('stops a running job with the square', async () => {
    const { emitted } = renderRow(job('running', 40))
    const action = screen.getByRole('button', {
      name: 'Stop this run Seedance shot'
    })
    expect(action).toHaveAttribute('data-action', 'stop')
    await userEvent.click(action)
    expect(emitted('cancel')).toHaveLength(1)
  })

  it.for(['queued', 'held'] as const)(
    'removes a %s job from the queue with an X, with no progress bar',
    async (status) => {
      const { emitted } = renderRow(job(status))
      expect(screen.getByTestId('queue-status-row')).toHaveAttribute(
        'data-status',
        status
      )
      expect(screen.queryByTestId('queue-status-row-progress')).toBeNull()
      const action = screen.getByRole('button', {
        name: 'Remove Seedance shot from the queue'
      })
      expect(action).toHaveAttribute('data-action', 'remove')
      await userEvent.click(action)
      expect(emitted('cancel')).toHaveLength(1)
    }
  )

  it.for(['plan', 'partner', 'provider'] as const)(
    'removes a job held by the %s limit with the X',
    async (heldBy) => {
      const { emitted } = renderRow(job('held', 0, heldBy))
      expect(screen.queryByRole('button', { name: 'Upgrade' })).toBeNull()
      await userEvent.click(
        screen.getByRole('button', {
          name: 'Remove Seedance shot from the queue'
        })
      )
      expect(emitted('cancel')).toHaveLength(1)
    }
  )

  it('keeps a failed row on the same surface as the others', () => {
    renderRow(job('failed'), 'Failed')
    const row = screen.getByTestId('queue-status-row')
    expect(row).toHaveClass('bg-secondary/60')
    expect(row.className).not.toContain('bg-destructive')
    expect(screen.getByText('Failed')).toHaveClass('text-destructive')
  })

  it('swaps the action for details on a failed job', async () => {
    const { emitted } = renderRow(job('failed'), 'Failed')
    expect(screen.queryByTestId('queue-status-row-cancel')).toBeNull()
    expect(screen.queryByTestId('queue-status-row-progress')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(emitted('details')).toHaveLength(1)
  })
})
