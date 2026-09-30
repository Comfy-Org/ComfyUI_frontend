import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import CinematicTakeNotice from './CinematicTakeNotice.vue'

const rejected: Extract<Take, { status: 'failed' }> = {
  id: 'a',
  shot: 1,
  letter: 'A',
  prompt: 'A boy dribbling on a beach court',
  modelSlug: 'model',
  aspect: '16:9',
  startedAt: 0,
  status: 'failed',
  reason: 'validation',
  requestId: 'request-1'
}

describe('CinematicTakeNotice', () => {
  it('never points at highlighted fields, since the studio highlights none', () => {
    render(CinematicTakeNotice, { props: { take: rejected } })

    expect(screen.queryByText('Check the highlighted fields.')).toBeNull()
    expect(
      screen.getByText(/rejected these inputs without identifying a field/)
    ).toBeInTheDocument()
  })

  it.for([
    ['byteplus--seedance-2-5-first-last-frame--animate-images', true],
    ['kling--v3--animate-images', false],
    [undefined, false]
  ] as const)(
    'on a block from %s, names the realistic-face rule: %s',
    ([runSlug, named]) => {
      render(CinematicTakeNotice, {
        props: { take: { ...rejected, reason: 'policy', runSlug } }
      })

      expect(!!screen.queryByText(/realistic human face/)).toBe(named)
      expect(
        !!screen.queryByText(/blocked the input or generated output/)
      ).toBe(!named)
    }
  )
})
