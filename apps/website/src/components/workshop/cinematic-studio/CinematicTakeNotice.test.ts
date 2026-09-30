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
})
