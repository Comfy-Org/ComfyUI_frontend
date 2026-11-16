import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import QueueStatusPill from '@/components/queue/QueueStatusPill.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      queueStatus: {
        stopAll: 'Stop every run',
        toggleList: 'Show or hide the run list'
      }
    }
  }
})

function renderPill(
  props: Partial<InstanceType<typeof QueueStatusPill>['$props']> = {}
) {
  return render(QueueStatusPill, {
    props: { label: 'Running', ...props },
    global: { plugins: [i18n] }
  })
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

  it('stops every run from the square', async () => {
    const user = userEvent.setup()
    const { emitted } = renderPill()
    await user.click(screen.getByTestId('queue-status-stop'))
    expect(emitted('stop')).toHaveLength(1)
  })

  it('shows the result on a Completed chip', () => {
    renderPill({
      label: 'Completed',
      terminalKind: 'completed',
      thumbSrc: 'data:image/png;base64,AA=='
    })
    expect(screen.getByTestId('queue-status-thumb')).toBeTruthy()
    expect(screen.queryByTestId('queue-status-stop')).toBeNull()
  })

  it('peeks the other runs as a stack while folded', () => {
    renderPill({ stack: 2 })
    const peeks = screen.getAllByTestId('queue-status-peek')
    expect(peeks).toHaveLength(2)
    expect(peeks.every((peek) => !peek.className.includes('opacity-0'))).toBe(
      true
    )
  })

  it('tucks the stack away when there is nothing behind the chip', () => {
    renderPill({ stack: 0 })
    expect(
      screen
        .getAllByTestId('queue-status-peek')
        .every((peek) => peek.className.includes('opacity-0'))
    ).toBe(true)
  })
})
