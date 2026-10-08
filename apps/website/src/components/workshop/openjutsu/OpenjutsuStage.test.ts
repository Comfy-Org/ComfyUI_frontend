import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { SwapTake } from '@/lib/workshop/openjutsu/take'
import OpenjutsuStage from './OpenjutsuStage.vue'

const take = (patch: Partial<SwapTake> = {}): SwapTake => ({
  id: 'take-1',
  n: 1,
  target: 'the man',
  window: { start: 2, seconds: 6 },
  seconds: 6,
  size: '768p',
  seed: 7,
  status: 'done',
  url: 'blob:result',
  ...patch
})

const editing = {
  videoUrl: 'blob:clip',
  clipSeconds: 20,
  range: { start: 2, seconds: 6 },
  partSeconds: 6,
  takes: [],
  selected: 'source',
  rendering: false,
  sample: false
}

const showing = (current: SwapTake) => ({
  ...editing,
  takes: [current],
  selected: current.id,
  current,
  rendering: current.status === 'rendering'
})

const player = () => screen.getByTestId('openjutsu-player')

describe('OpenjutsuStage', () => {
  it('invites a video before there is one', () => {
    render(OpenjutsuStage, { props: { ...editing, videoUrl: undefined } })

    expect(screen.getByText('Your swapped video plays here')).toBeVisible()
    expect(screen.queryByTestId('openjutsu-player')).not.toBeInTheDocument()
  })

  it('shows the clip and the part to swap, with the way back to trimming', async () => {
    const { emitted } = render(OpenjutsuStage, { props: editing })

    expect(player()).toHaveAttribute('src', 'blob:clip')
    expect(
      screen.getByText('Swapping 2.0 – 8.0 s (6.0 s of 20.0 s)')
    ).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Trim' }))
    expect(emitted('trim')).toHaveLength(1)
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('covers the player while a take renders, and lets it be cancelled', async () => {
    const rendering = take({
      status: 'rendering',
      phase: 'queued',
      url: undefined
    })
    const { emitted } = render(OpenjutsuStage, { props: showing(rendering) })

    expect(screen.getByTestId('openjutsu-progress')).toHaveTextContent(
      'Waiting for a server'
    )
    expect(screen.queryByTestId('openjutsu-part')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(emitted('cancel')).toHaveLength(1)
  })

  it('says why a take failed and offers the way back to its settings', async () => {
    const failed = take({
      status: 'failed',
      url: undefined,
      note: 'No credits left'
    })
    const { emitted } = render(OpenjutsuStage, { props: showing(failed) })

    expect(screen.getByRole('alert')).toHaveTextContent('No credits left')
    await userEvent.click(
      screen.getByRole('button', { name: 'Back to settings' })
    )
    expect(emitted('reuse')).toEqual([['take-1']])
  })

  it('plays a finished take, flips to its source and back, and offers the file', async () => {
    const { emitted } = render(OpenjutsuStage, { props: showing(take()) })

    expect(player()).toHaveAttribute('src', 'blob:result')
    expect(screen.getByText(/Replaced the man/)).toBeVisible()
    expect(
      screen.queryByTestId('openjutsu-sample-note')
    ).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute(
      'download',
      'openjutsu-take-1.mp4'
    )

    await userEvent.click(screen.getByRole('radio', { name: 'Source' }))
    expect(player()).toHaveAttribute('src', 'blob:clip')
    expect(screen.getByRole('radio', { name: 'Source' })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: 'Result' }))
    expect(player()).toHaveAttribute('src', 'blob:result')

    await userEvent.click(
      screen.getByRole('button', { name: 'Use these settings' })
    )
    expect(emitted('reuse')).toEqual([['take-1']])
  })

  it('marks a result from the stand-in backend as not real', () => {
    render(OpenjutsuStage, { props: { ...showing(take()), sample: true } })

    expect(screen.getByTestId('openjutsu-sample-note')).toHaveTextContent(
      'Sample result'
    )
  })

  it('lists the source and every take, and says which was picked', async () => {
    const second = take({
      id: 'take-2',
      n: 2,
      status: 'failed',
      url: undefined
    })
    const { emitted } = render(OpenjutsuStage, {
      props: { ...showing(take()), takes: [take(), second] }
    })

    expect(screen.getByRole('button', { name: 'Take 1' })).toHaveAttribute(
      'aria-current',
      'true'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Take 2' }))
    await userEvent.click(screen.getByRole('button', { name: 'Source video' }))
    expect(emitted('select')).toEqual([['take-2'], ['source']])
  })
})
