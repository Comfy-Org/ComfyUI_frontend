import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { getAuthoredRouterWorkshopModelDetail } from '../../../config/workshop-router-content'
import { runnableCinematicModels } from '../../../lib/workshop/cinematic-studio/models'
import type { SavedCreation } from '../../../lib/workshop/cinematic-studio/creations'
import type { MotionComparisonPayload } from '../../../lib/workshop/cinematic-studio/motion-comparison'
import CinematicMotionCompare from './CinematicMotionCompare.vue'
const models = runnableCinematicModels(getAuthoredRouterWorkshopModelDetail)
const source = {
  file: new File(['image'], 'frame.png', { type: 'image/png' }),
  url: 'blob:frame',
  name: 'Starting image'
}
describe('motion comparison dialog', () => {
  it('reviews separate prompts without closing the editor or generating', async () => {
    const user = userEvent.setup()
    const { emitted, rerender } = render(CinematicMotionCompare, {
      props: {
        open: true,
        source,
        models,
        scene: 'A lantern flickers.',
        namespace: 'account-a'
      }
    })
    await user.click(await screen.findByRole('checkbox', { name: 'Push in' }))
    await user.click(screen.getByRole('button', { name: 'Review clips' }))
    const payload = emitted<MotionComparisonPayload[]>('review')[0][0]
    expect(payload).toMatchObject({
      sourceFile: source.file,
      clips: [{ movement: 'locked' }, { movement: 'push-in' }]
    })
    expect(emitted('update:open')).toBeUndefined()
    await rerender({ scene: 'Changed parent text' })
    expect(
      screen.getByRole('textbox', { name: 'Scene and action for every clip' })
    ).toHaveValue('A lantern flickers.')
  })
  it('does not load a flagged source until reveal, then clears it on namespace change', async () => {
    const item: SavedCreation = {
      id: 'saved',
      takeId: 'saved',
      name: 'Sensitive frame',
      modelSlug: 'model',
      prompt: 'frame',
      aspect: '16:9',
      createdAt: 1,
      kind: 'image',
      fileName: 'frame.png',
      favorite: false,
      nsfw: true,
      blob: source.file
    }
    const user = userEvent.setup()
    const { rerender } = render(CinematicMotionCompare, {
      props: {
        open: true,
        models,
        scene: 'A lantern flickers.',
        namespace: 'account-a',
        items: [item],
        urls: { saved: 'blob:sensitive' }
      }
    })
    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Choose a saved image' }),
      'saved'
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Review clips' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Reveal image' }))
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:sensitive')
    await rerender({ namespace: 'account-b', items: [], urls: {} })
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
