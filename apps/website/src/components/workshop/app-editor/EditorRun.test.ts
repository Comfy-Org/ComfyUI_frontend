import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import EditorRun from './EditorRun.vue'
import type { RunProgress } from './run-progress'

function renderRun(
  props: {
    running?: boolean
    block?: boolean
    progress?: RunProgress
    missing?: string
    disabled?: boolean
  } = {}
) {
  return render(EditorRun, {
    props: {
      label: 'Try it on',
      credits: '8 credits',
      cancelLabel: 'Cancel',
      queuedLabel: 'Queued',
      running: false,
      ...props
    }
  })
}

describe('EditorRun', () => {
  it('runs, naming what it costs', async () => {
    const { emitted } = renderRun()

    await userEvent.click(screen.getByRole('button', { name: /Try it on/ }))

    expect(screen.getByText('8 credits')).toBeVisible()
    expect(emitted('run')).toHaveLength(1)
  })

  it.for([
    { progress: undefined, shown: null },
    { progress: { kind: 'queued' } as const, shown: 'Queued' },
    { progress: { kind: 'running', percent: 42 } as const, shown: '42%' }
  ])('shows $shown while running', async ({ progress, shown }) => {
    const { emitted } = renderRun({ running: true, progress })

    const status = screen.queryByTestId('editor-run-progress')
    if (shown) expect(status).toHaveTextContent(shown)
    else expect(status).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Cancel/ }))
    expect(emitted('cancel')).toHaveLength(1)
  })

  it.for([false, true])(
    'says what is missing instead of its label and credits (block: %s)',
    (block) => {
      renderRun({ block, missing: 'Upload a garment' })

      const run = screen.getByRole('button', { name: 'Upload a garment' })
      expect(run).toBeDisabled()
      expect(run).toHaveAttribute('title', 'Upload a garment')
      expect(screen.queryByText('8 credits')).toBeNull()
    }
  )

  it('keeps the credits on a button disabled for another reason', () => {
    renderRun({ disabled: true })

    expect(screen.getByRole('button', { name: /Try it on/ })).toBeDisabled()
    expect(screen.getByText('8 credits')).toBeVisible()
  })
})
