import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import CinematicTakeProgress from './CinematicTakeProgress.vue'

const take: Take = {
  id: 'take-1',
  shot: 1,
  letter: 'A',
  prompt: 'a courtyard at dusk',
  modelSlug: 'bfl--flux-2-max--generate-images',
  aspect: '16:9',
  startedAt: Date.now(),
  status: 'rendering'
}

describe('CinematicTakeProgress', () => {
  // The buttons under the stage call this frame "Shot 1, take A". The frame
  // that is running has to answer to the same name, and "Rendering take A"
  // read as an instruction rather than as the name of a take.
  it('calls the running take what the take buttons call it', () => {
    render(CinematicTakeProgress, { props: { take } })

    const caption = screen.getByRole('status')
    expect(caption).toHaveTextContent('Shot 1, take A')
    expect(caption).toHaveTextContent('0:00')
  })
})
