import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import CinematicTakeProgress from './CinematicTakeProgress.vue'

const renderingTake = (): Take => ({
  id: 'take-1',
  shot: 1,
  letter: 'A',
  prompt: 'a courtyard at dusk',
  modelSlug: 'bfl--flux-2-max--generate-images',
  aspect: '16:9',
  startedAt: Date.now(),
  status: 'rendering'
})

describe('CinematicTakeProgress', () => {
  it('says a take is rendering and names it as the take buttons do', () => {
    render(CinematicTakeProgress, { props: { take: renderingTake() } })

    const caption = screen.getByRole('status')
    expect(caption).toHaveTextContent('Rendering Shot 1, take A')
    expect(caption).toHaveTextContent(/\d+:\d{2}/)
  })
})
