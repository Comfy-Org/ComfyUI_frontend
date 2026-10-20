import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { VideoFacts } from '@/lib/workshop/video-trim/filmstrip'
import { readVideoFacts } from '@/lib/workshop/video-trim/filmstrip'
import type { TrimRange } from '@/lib/workshop/video-trim/range'
import VideoTrimDialog from './VideoTrimDialog.vue'

vi.mock(import('@/lib/workshop/video-trim/filmstrip'))

const file = new File(['clip'], 'clip.mp4', { type: 'video/mp4' })
const limits = { min: 5, max: 15 }
const facts = (duration: number): VideoFacts => ({
  duration,
  width: 1920,
  height: 1080
})

const confirmButton = () => screen.getByRole('button', { name: 'Confirm' })

function open(initial?: TrimRange) {
  const props = { open: true, file, limits, initial }
  return render(VideoTrimDialog, { props })
}

describe('VideoTrimDialog', () => {
  beforeEach(() => {
    vi.mocked(readVideoFacts).mockResolvedValue(facts(20))
  })

  it('offers the longest part from the start and hands it back with what was read', async () => {
    const { emitted } = open()

    expect(
      await screen.findByText('0:00.0 – 0:15.0 · 15.0 s of 20.0 s')
    ).toBeVisible()
    await userEvent.click(confirmButton())

    expect(emitted('confirm')).toEqual([
      [{ start: 0, end: 15, duration: 20, width: 1920, height: 1080 }]
    ])
    expect(emitted('update:open')).toEqual([[false]])
  })

  it('reopens on the part chosen earlier for the same video', async () => {
    open({ start: 2, end: 8 })

    expect(
      await screen.findByText('0:02.0 – 0:08.0 · 6.0 s of 20.0 s')
    ).toBeVisible()
  })

  it('says a video is too short and will not confirm it', async () => {
    vi.mocked(readVideoFacts).mockResolvedValue(facts(3))
    const { emitted } = open()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This video is 3.0 s long. It needs to be at least 5 s.'
    )
    expect(confirmButton()).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Play the selected part' })
    ).toBeDisabled()
    expect(emitted('confirm')).toBeUndefined()
  })

  it('says a video could not be read and will not confirm it', async () => {
    vi.mocked(readVideoFacts).mockResolvedValue(undefined)
    open()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This video could not be read. Try an MP4.'
    )
    expect(confirmButton()).toBeDisabled()
  })

  it('closes on Cancel without choosing anything', async () => {
    const { emitted } = open()
    await screen.findByText('0:00.0 – 0:15.0 · 15.0 s of 20.0 s')

    await userEvent.click(screen.getAllByRole('button', { name: 'Cancel' })[0])

    expect(emitted('update:open')).toEqual([[false]])
    expect(emitted('confirm')).toBeUndefined()
  })
})
