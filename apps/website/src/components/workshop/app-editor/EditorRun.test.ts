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
    missingHint?: string
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
    { progress: { kind: 'queued' } as const, shown: 'Queued' },
    { progress: { kind: 'running', percent: 42 } as const, shown: '42%' }
  ])('shows $shown while running', async ({ progress, shown }) => {
    const { emitted } = renderRun({ running: true, progress })

    expect(screen.getByTestId('editor-run-progress')).toHaveTextContent(shown)
    await userEvent.click(screen.getByRole('button', { name: /Cancel/ }))
    expect(emitted('cancel')).toHaveLength(1)
  })

  it('shows no progress while running before any arrives', async () => {
    const { emitted } = renderRun({ running: true, progress: undefined })

    expect(screen.queryByTestId('editor-run-progress')).toBeNull()
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

  it('puts the full sentence in the tooltip when the label is short', () => {
    renderRun({
      missing: 'Add a garment',
      missingHint: 'Upload a garment photo to try on.'
    })

    expect(
      screen.getByRole('button', { name: 'Add a garment' })
    ).toHaveAttribute('title', 'Upload a garment photo to try on.')
  })

  it('keeps the credits on a button disabled for another reason', () => {
    renderRun({ disabled: true })

    expect(screen.getByRole('button', { name: /Try it on/ })).toBeDisabled()
    expect(screen.getByText('8 credits')).toBeVisible()
  })
})
