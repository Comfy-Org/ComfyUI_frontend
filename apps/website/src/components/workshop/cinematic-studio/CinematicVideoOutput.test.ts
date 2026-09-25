import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { Take } from '../../../lib/workshop/cinematic-studio/reel'
import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import { t } from '../../../i18n/translations'
import CinematicStage from './CinematicStage.vue'
import CinematicStageCard from './CinematicStageCard.vue'
import CinematicTakeFrame from './CinematicTakeFrame.vue'

function take(
  kind: 'image' | 'video',
  nsfw = false
): Extract<Take, { status: 'done' }> {
  return {
    id: 'take-1',
    shot: 1,
    letter: 'A',
    prompt: 'Rain over the city',
    modelSlug: 'model',
    aspect: '16:9',
    startedAt: 0,
    status: 'done',
    output: {
      kind,
      url: `blob:${kind}`,
      fileName: kind === 'video' ? 'take.mp4' : 'take.png',
      nsfw
    }
  }
}

describe('Cinematic video output', () => {
  it('offers controlled playback and video download without image actions', () => {
    const current = take('video')
    render(CinematicStage, {
      props: { reel: { takes: [current], selectedId: current.id }, models: [] }
    })

    const video = screen.getByLabelText(tc('cinematic.video.preview', 'en'))
    expect(video).toHaveAttribute('src', 'blob:video')
    expect(video).toHaveAttribute('controls')
    expect(video).not.toHaveAttribute('autoplay')
    expect(
      screen.getByRole('link', { name: tc('cinematic.stage.download', 'en') })
    ).toHaveAttribute('download', 'take.mp4')
    expect(
      screen.queryByRole('button', {
        name: tc('cinematic.stage.useAsReference', 'en')
      })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: tc('cinematic.video.animate', 'en')
      })
    ).not.toBeInTheDocument()
  })

  it('loads a flagged video only after reveal and hides the next flagged take', async () => {
    const user = userEvent.setup()
    const current = take('video', true)
    const { rerender } = render(CinematicTakeFrame, { props: { current } })

    expect(
      screen.queryByLabelText(tc('cinematic.video.preview', 'en'))
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: t('workshop.output.reveal', 'en') })
    )
    expect(
      screen.getByLabelText(tc('cinematic.video.preview', 'en'))
    ).toHaveAttribute('src', 'blob:video')
    await rerender({ current: { ...current, id: 'take-2' } })
    expect(
      screen.queryByLabelText(tc('cinematic.video.preview', 'en'))
    ).not.toBeInTheDocument()
  })

  it.for([CinematicStage, CinematicStageCard])(
    'keeps image reference and animation actions available',
    async (component) => {
      const user = userEvent.setup()
      const current = take('image')
      const { emitted } = render(component, {
        props: {
          reel: { takes: [current], selectedId: current.id },
          models: [],
          aspect: '16:9'
        }
      })

      expect(screen.getByAltText(current.prompt)).toHaveAttribute(
        'src',
        'blob:image'
      )
      await user.click(
        screen.getByRole('button', {
          name: tc('cinematic.stage.useAsReference', 'en')
        })
      )
      expect(emitted('reference')).toEqual([['blob:image', 'take.png']])
      await user.click(
        screen.getByRole('button', {
          name: tc('cinematic.video.animate', 'en')
        })
      )
      expect(emitted('animate')).toEqual([['blob:image', 'take.png']])
    }
  )
})
