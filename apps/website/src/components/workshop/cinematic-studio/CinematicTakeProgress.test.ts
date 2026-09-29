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
  startedAt: 0,
  status: 'rendering'
}

describe('CinematicTakeProgress', () => {
  // The buttons under the stage call this frame "Shot 1, take A". The frame
  // that is running has to answer to the same name, and "Rendering take A"
  // read as an instruction rather than as the name of a take.
  it('calls the running take what the take buttons call it', () => {
    // The clock counts from the take's own start, so a fixture frozen at
    // module load would drift against it as the suite runs.
    render(CinematicTakeProgress, {
      props: { take: { ...take, startedAt: Date.now() } }
    })

    const caption = screen.getByRole('status')
    expect(caption).toHaveTextContent('Shot 1, take A')
    expect(caption).toHaveTextContent('0:00')
  })
})
