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
  range: { start: 2, seconds: 6 },
  partSeconds: 6,
  frame: { width: 1344, height: 768 },
  takes: [],
  selected: 'source',
  rendering: false,
  sample: false,
  view: 'result' as const
}

const showing = (current: SwapTake) => ({
  ...editing,
  takes: [current],
  selected: current.id,
  current,
  rendering: current.status === 'rendering'
})

describe('OpenjutsuStage', () => {
  it('asks for a video before there is one, and hands the pick over', async () => {
    const { emitted } = render(OpenjutsuStage, {
      props: { ...editing, videoUrl: undefined }
    })
    const file = new File(['clip'], 'clip.mp4', { type: 'video/mp4' })

    expect(screen.getByText('Your swapped video plays here')).toBeVisible()
    await userEvent.upload(screen.getByLabelText('Add the video to edit'), file)
    expect(emitted('video')).toEqual([[file]])
  })

  it('plays the clip in the site player before any take', () => {
    render(OpenjutsuStage, { props: editing })

    expect(screen.getByLabelText('Your clip')).toHaveAttribute(
      'src',
      'blob:clip'
    )
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('covers the player while a take renders, and lets it be cancelled', async () => {
    const rendering = take({
      status: 'rendering',
      phase: 'queued',
      url: undefined
    })
    const { emitted } = render(OpenjutsuStage, { props: showing(rendering) })

    expect(screen.getByText('Waiting for a server')).toBeVisible()
    expect(screen.getByText('0:00 elapsed')).toBeVisible()
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

  it.for([
    { view: 'result', label: 'Replaced the man', src: 'blob:result' },
    { view: 'original', label: 'Your clip', src: 'blob:clip' }
  ] as const)('plays the $view of a finished take', ({ view, label, src }) => {
    render(OpenjutsuStage, { props: { ...showing(take()), view } })

    expect(screen.getByLabelText(label)).toHaveAttribute('src', src)
    expect(
      screen.queryByRole('slider', { name: /compare/ })
    ).not.toBeInTheDocument()
  })

  it('splits the result and its source under one set of controls in compare', () => {
    render(OpenjutsuStage, {
      props: { ...showing(take()), view: 'compare' }
    })

    expect(screen.getByLabelText('Replaced the man')).toHaveAttribute(
      'src',
      'blob:result'
    )
    expect(
      screen.getByRole('slider', {
        name: 'Drag to compare the source and the result'
      })
    ).toHaveValue('50')
    expect(screen.getAllByRole('button', { name: 'Play' })).toHaveLength(1)
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
