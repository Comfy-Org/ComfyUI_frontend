import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { Reel, Take } from '../../../lib/workshop/cinematic-studio/reel'
import CinematicStageCard from './CinematicStageCard.vue'

const models = [
  { slug: 'seedream', name: 'Seedream 4.5', provider: 'ByteDance', logo: '' }
]

function take(overrides: Partial<Take> = {}): Take {
  return {
    id: 'a',
    shot: 1,
    letter: 'A',
    prompt: 'A diner at dawn',
    modelSlug: 'seedream',
    aspect: '21:9',
    startedAt: Date.now(),
    status: 'rendering',
    ...overrides
  } as Take
}

function renderCard(reel: Reel) {
  return render(CinematicStageCard, {
    props: { reel, aspect: '21:9', models }
  })
}

describe('CinematicStageCard', () => {
  it('names the shot, model and frame beside the output title', () => {
    renderCard({ takes: [take()], selectedId: 'a' })

    const header = screen.getByTestId('cinematic-output-header')
    expect(header).toHaveTextContent('Output')
    expect(within(header).getByText('Shot 1')).toBeInTheDocument()
    expect(
      within(header).getByText('Seedream 4.5 · 21:9', { exact: false })
    ).toBeInTheDocument()
  })

  it('keeps the header to its title before the first shot', () => {
    renderCard({ takes: [] })

    expect(screen.getByTestId('cinematic-output-header')).toHaveTextContent(
      /^Output$/
    )
  })

  it('says which take is rendering while it runs', () => {
    renderCard({ takes: [take({ letter: 'B' })], selectedId: 'a' })

    expect(screen.getByRole('status')).toHaveTextContent('Rendering take B')
  })
})
