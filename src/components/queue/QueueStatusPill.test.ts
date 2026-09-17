import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import QueueStatusPill from '@/components/queue/QueueStatusPill.vue'

function renderPill(
  props: Partial<InstanceType<typeof QueueStatusPill>['$props']> = {}
) {
  return render(QueueStatusPill, { props: { label: 'Running', ...props } })
}

describe('QueueStatusPill', () => {
  it('announces the label and reports the folded state', () => {
    renderPill({ badge: 'Queued 2', expanded: false })
    expect(
      screen.getByTestId('queue-status-toast').getAttribute('aria-expanded')
    ).toBe('false')
    expect(screen.getByText('Running').getAttribute('aria-live')).toBe('polite')
    expect(screen.getByText('Queued 2')).toBeTruthy()
  })

  it('tracks a single run with the progress line', () => {
    renderPill({ progress: 64 })
    expect(screen.getByTestId('queue-status-progress')).toHaveStyle({
      width: '64%'
    })
  })

  it('drops aria-expanded and the spinner for a terminal chip', () => {
    renderPill({ label: 'Failed', terminalKind: 'failed' })
    expect(
      screen.getByTestId('queue-status-toast').hasAttribute('aria-expanded')
    ).toBe(false)
    expect(screen.queryByTestId('queue-status-spinner')).toBeNull()
  })

  it('emits activate on click', async () => {
    const user = userEvent.setup()
    const { emitted } = renderPill()
    await user.click(screen.getByTestId('queue-status-toast'))
    expect(emitted('activate')).toHaveLength(1)
  })
})
