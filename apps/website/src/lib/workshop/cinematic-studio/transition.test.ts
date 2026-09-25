import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CinematicTransition from '../../../components/workshop/cinematic-studio/CinematicTransition.vue'
import type { SavedCreation } from './creations'
import {
  savedTransitionFrame,
  transitionModels,
  transitionPayload,
  uploadedTransitionFrame
} from './transition'
import type { TransitionModel } from './transition'

const png = (name = 'frame.png') =>
  new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], name, {
    type: 'image/png'
  })
const model: TransitionModel = {
  slug: 'seedance',
  name: 'Seedance',
  mode: 'video',
  video: {
    durations: [5],
    resolutions: ['720p'],
    aspects: ['16:9'],
    defaultDuration: 5,
    defaultResolution: '720p',
    firstFrame: 'required',
    lastFrame: true,
    generateAudio: true
  }
}
const creation = (id: string, nsfw = false): SavedCreation => ({
  id,
  takeId: id,
  name: id,
  modelSlug: 'image-model',
  prompt: 'Harbor',
  aspect: '16:9',
  createdAt: 1,
  kind: 'image',
  fileName: `${id}.png`,
  nsfw,
  favorite: false,
  blob: png(`${id}.png`)
})
const props = () => ({
  open: true,
  items: [creation('start'), creation('end')],
  urls: {},
  models: [model],
  namespace: 'demo'
})

describe('transition boundary preparation', () => {
  it('offers only models supporting both boundary frames', () => {
    expect(
      transitionModels([
        model,
        { slug: 'image', name: 'Image', mode: 'image' },
        {
          ...model,
          slug: 'first-only',
          video: { ...model.video!, lastFrame: false }
        },
        {
          ...model,
          slug: 'unsupported',
          video: { ...model.video!, firstFrame: 'unsupported' }
        }
      ])
    ).toEqual([model])
  })

  it('keeps source identifiers paired with their files when swapped', async () => {
    const start = await savedTransitionFrame(creation('start'))
    const end = await savedTransitionFrame(creation('end'))
    expect(
      transitionPayload(model.slug, [model], end, start, '  Pan left  ')
    ).toMatchObject({
      firstSourceId: 'end',
      lastSourceId: 'start',
      firstFrame: end.file,
      lastFrame: start.file,
      scene: 'Pan left'
    })
    expect(() => transitionPayload('missing', [model], start, end)).toThrow()
    expect(() =>
      transitionPayload(model.slug, [model], start, end, 'x'.repeat(8001))
    ).toThrow()
  })

  it('requires reveal before reading a flagged saved image', async () => {
    const flagged = creation('flagged', true)
    const blob = flagged.blob
    const read = vi.spyOn(flagged, 'blob', 'get').mockReturnValue(blob)
    await expect(savedTransitionFrame(flagged)).rejects.toThrow(
      'Frame unavailable'
    )
    expect(read).not.toHaveBeenCalled()
    await expect(savedTransitionFrame(flagged, true)).resolves.toHaveProperty(
      'sourceId',
      'flagged'
    )
  })

  it('rejects videos and invalid uploaded image contents', async () => {
    await expect(
      savedTransitionFrame({ ...creation('video'), kind: 'video' })
    ).rejects.toThrow()
    await expect(
      uploadedTransitionFrame(
        new File(['bad'], 'bad.png', { type: 'image/png' })
      )
    ).rejects.toThrow()
    await expect(uploadedTransitionFrame(png())).resolves.toHaveProperty(
      'file.name',
      'frame.png'
    )
  })
})

describe('transition dialog', () => {
  it('previews and swaps boundaries but applies only on explicit action', async () => {
    const user = userEvent.setup()
    const { emitted } = render(CinematicTransition, { props: props() })
    const first = within(
      await screen.findByRole('region', { name: 'First frame' })
    )
    const last = within(screen.getByRole('region', { name: 'Last frame' }))
    await user.selectOptions(
      first.getByLabelText('Choose a saved image'),
      'start'
    )
    await user.selectOptions(last.getByLabelText('Choose a saved image'), 'end')
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Use these frames' })
      ).toBeEnabled()
    )
    expect(emitted('apply')).toBeUndefined()
    await user.click(screen.getByRole('button', { name: 'Swap frames' }))
    await user.type(
      screen.getByLabelText('Scene and action between the frames'),
      'Pan left'
    )
    await user.click(screen.getByRole('button', { name: 'Use these frames' }))
    expect(emitted('apply')).toEqual([
      [
        expect.objectContaining({
          modelSlug: 'seedance',
          firstSourceId: 'end',
          lastSourceId: 'start',
          scene: 'Pan left'
        })
      ]
    ])
  })

  it('does not load flagged previews before reveal', async () => {
    const user = userEvent.setup()
    render(CinematicTransition, {
      props: { ...props(), items: [creation('flagged', true)] }
    })
    const first = within(
      await screen.findByRole('region', { name: 'First frame' })
    )
    await user.selectOptions(
      first.getByLabelText('Choose a saved image'),
      'flagged'
    )
    expect(first.queryByRole('img')).not.toBeInTheDocument()
    await user.click(
      first.getByRole('button', { name: 'Reveal and use frame' })
    )
    expect(await first.findByRole('img')).toBeInTheDocument()
  })

  it('discards a pending file read when the account scope changes', async () => {
    const user = userEvent.setup()
    const file = png()
    const header = file.slice(0, 12)
    let finish: (buffer: ArrayBuffer) => void = () => {}
    vi.spyOn(file, 'slice').mockReturnValue(header)
    vi.spyOn(header, 'arrayBuffer').mockReturnValue(
      new Promise<ArrayBuffer>((resolve) => {
        finish = resolve
      })
    )
    const { rerender, emitted } = render(CinematicTransition, {
      props: props()
    })
    const first = within(
      await screen.findByRole('region', { name: 'First frame' })
    )
    await user.upload(first.getByLabelText('Upload an image'), file)
    await rerender({ namespace: 'another-account' })
    const bytes = new ArrayBuffer(8)
    new Uint8Array(bytes).set([137, 80, 78, 71, 13, 10, 26, 10])
    finish(bytes)
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Use these frames' })
      ).toBeDisabled()
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(emitted('apply')).toBeUndefined()
  })
})
