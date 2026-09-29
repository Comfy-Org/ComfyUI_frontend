import { fireEvent, render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import CinematicTakeFrame from './CinematicTakeFrame.vue'

const done: Take = {
  id: 'a',
  shot: 1,
  letter: 'A',
  prompt: 'A lighthouse at dusk',
  modelSlug: 'model',
  aspect: '16:9',
  startedAt: 0,
  status: 'done',
  output: { kind: 'image', url: 'blob:take', fileName: 'take.png' }
}

describe('CinematicTakeFrame', () => {
  it('keeps the frame and a spinner until the picture has loaded', async () => {
    render(CinematicTakeFrame, { props: { current: done } })
    const figure = screen.getByRole('figure')
    expect(figure.getAttribute('style')).toContain('aspect-ratio: 16 / 9')
    expect(screen.getByLabelText('Loading the take')).toBeInTheDocument()

    await fireEvent.load(screen.getByAltText('A lighthouse at dusk'))

    expect(figure.getAttribute('style') ?? '').not.toContain('aspect-ratio')
    expect(screen.queryByLabelText('Loading the take')).toBeNull()
  })
})
