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
    en: { queueStatus: { cancel: 'Stop this run', details: 'Details' } }
  }
})

const job = (status: JobView['status'], progress = 0): JobView => ({
  id: 'a',
  title: 'Seedance shot',
  status,
  progress,
  queuePosition: 0
})

function renderRow(row: JobView, subtitle = '') {
  return render(QueueStatusRow, {
    props: { job: row, subtitle, delayMs: 0 },
    global: { plugins: [i18n] }
  })
}

describe('QueueStatusRow', () => {
  it('shows its own progress line while running', () => {
    renderRow(job('running', 40), '0:52 · 40%')
    expect(screen.getByTestId('queue-status-row-progress')).toHaveStyle({
      width: '40%'
    })
    expect(screen.getByText('0:52 · 40%')).toBeInTheDocument()
  })

  it('offers stop on a held job, with no progress line', () => {
    renderRow(job('held'), 'Waiting · the provider is busy')
    expect(screen.getByTestId('queue-status-row')).toHaveAttribute(
      'data-status',
      'held'
    )
    expect(screen.queryByTestId('queue-status-row-progress')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Stop this run Seedance shot' })
    ).toBeInTheDocument()
  })

  it('swaps stop for details on a failed job', async () => {
    const { emitted } = renderRow(job('failed'), 'Failed')
    expect(screen.queryByTestId('queue-status-row-cancel')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(emitted('details')).toHaveLength(1)
  })
})
