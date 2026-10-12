import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { translationsFor } from '@/i18n/translations'
import { fileSecondsOf } from '@/lib/workshop/cinematic-studio/reshoot-clip'
import ReshootClipRow from './ReshootClipRow.vue'

vi.mock(import('@/lib/workshop/cinematic-studio/reshoot-clip'), () => ({
  clipSecondsOf: vi.fn(),
  fileSecondsOf: vi.fn()
}))

const { t: rc } = translationsFor('en')

const clip = (name = 'clip.mp4', type = 'video/mp4') =>
  new File(['clip'], name, { type })

function setup() {
  const { emitted } = render(ReshootClipRow, {
    props: { clip: 'clip.mp4', name: 'Sci-fi pilot', status: 'Ready' }
  })
  const input = screen.getByLabelText(rc('reshoot.clip.upload'))
  if (!(input instanceof HTMLInputElement)) throw new Error('No file input')
  return {
    input,
    picked: () => emitted<[File]>().pick
  }
}

beforeEach(() => {
  vi.mocked(fileSecondsOf).mockResolvedValue(10)
})

describe('ReshootClipRow', () => {
  it('names the clip and offers to replace it', () => {
    setup()

    expect(screen.getByText('Sci-fi pilot')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: rc('reshoot.clip.replace') })
    ).toHaveAttribute('title', rc('reshoot.clip.upload'))
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
  ])('takes $name dropped on the row: $taken', async ({ file, taken }) => {
    const { picked } = setup()

    await fireEvent.drop(screen.getByTestId('reshoot-clip'), {
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
