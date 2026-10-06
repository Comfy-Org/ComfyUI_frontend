import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { translationsFor } from '@/i18n/translations'
import { fileSecondsOf } from '@/lib/workshop/cinematic-studio/reshoot-clip'
import ReshootUpload from './ReshootUpload.vue'

vi.mock(import('@/lib/workshop/cinematic-studio/reshoot-clip'), () => ({
  clipSecondsOf: vi.fn(),
  fileSecondsOf: vi.fn()
}))

const { t: rc } = translationsFor('en')

const clip = (name = 'clip.mp4', type = 'video/mp4') =>
  new File(['clip'], name, { type })

function setup() {
  const { emitted } = render(ReshootUpload)
  const input = screen.getByLabelText(new RegExp(rc('reshoot.clip.upload')))
  if (!(input instanceof HTMLInputElement)) throw new Error('No file input')
  return { input, picked: () => emitted<[File]>().pick }
}

beforeEach(() => {
  vi.mocked(fileSecondsOf).mockResolvedValue(10)
})

describe('ReshootUpload', () => {
  it('names what to upload and how', () => {
    setup()

    expect(screen.getByText(rc('reshoot.clip.upload'))).toBeInTheDocument()
    expect(screen.getByText(rc('reshoot.clip.browse'))).toBeInTheDocument()
  })

  it('hands over a chosen clip and lets the same one be chosen again', async () => {
    const { input, picked } = setup()
    const chosen = clip()

    await userEvent.setup().upload(input, chosen)

    await vi.waitFor(() => expect(picked()).toEqual([[chosen]]))
    expect(input.files).toHaveLength(0)
  })

  it.for([
    { name: 'a video', file: clip(), taken: true },
    { name: 'an image', file: clip('still.png', 'image/png'), taken: false }
  ])('takes $name dropped on the zone: $taken', async ({ file, taken }) => {
    const { picked } = setup()

    await fireEvent.drop(screen.getByTestId('reshoot-upload'), {
      dataTransfer: { files: [file] }
    })

    await vi.waitFor(() =>
      expect(picked()).toEqual(taken ? [[file]] : undefined)
    )
  })

  it('turns away a clip outside 5 to 15 seconds and says why', async () => {
    vi.mocked(fileSecondsOf).mockResolvedValue(30)
    const { input, picked } = setup()

    await userEvent.setup().upload(input, clip('long.mp4'))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      rc('reshoot.clip.rejected', { name: 'long.mp4', seconds: '30.0' })
    )
    expect(picked()).toBeUndefined()
  })
})
