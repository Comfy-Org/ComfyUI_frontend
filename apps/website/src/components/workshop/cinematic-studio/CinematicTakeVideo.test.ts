import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CinematicTakeVideo from './CinematicTakeVideo.vue'

const clip = () => screen.getByLabelText<HTMLVideoElement>('Generated video')

function lengthOf(video: HTMLVideoElement, seconds: number) {
  Object.defineProperty(video, 'duration', {
    configurable: true,
    value: seconds
  })
}

function mount() {
  const view = render(CinematicTakeVideo, {
    props: { src: 'blob:clip', height: '60svh', locale: 'en' }
  })
  return { ...view, user: userEvent.setup() }
}

describe('CinematicTakeVideo', () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(
      async function (this: HTMLMediaElement) {
        this.dispatchEvent(new Event('play'))
      }
    )
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
      function (this: HTMLMediaElement) {
        this.dispatchEvent(new Event('pause'))
      }
    )
  })

  it('shows its own controls and no native ones', () => {
    mount()

    expect(clip()).not.toHaveAttribute('controls')
    expect(screen.getByTestId('cinematic-video-play')).toBeInTheDocument()
    expect(screen.getByTestId('cinematic-video-controls')).toBeVisible()
    expect(screen.getByRole('slider', { name: 'Seek' })).toBeDisabled()
  })

  it('plays from the big button, then pauses from the bar', async () => {
    const { user } = mount()

    await user.click(screen.getByTestId('cinematic-video-play'))
    await vi.waitFor(() =>
      expect(screen.queryByTestId('cinematic-video-play')).toBeNull()
    )
    expect(screen.getByTestId('cinematic-video-controls')).toHaveClass(
      'opacity-0'
    )

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    await vi.waitFor(() =>
      expect(screen.getByTestId('cinematic-video-play')).toBeInTheDocument()
    )
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled()
  })

  it('reads the length and follows a change to it', async () => {
    mount()
    lengthOf(clip(), 10)
    await fireEvent(clip(), new Event('loadedmetadata'))

    expect(screen.getByTestId('cinematic-video-time')).toHaveTextContent(
      '0:00 / 0:10'
    )
    expect(screen.getByRole('slider', { name: 'Seek' })).toBeEnabled()

    lengthOf(clip(), 75)
    await fireEvent(clip(), new Event('durationchange'))
    expect(screen.getByTestId('cinematic-video-time')).toHaveTextContent(
      '0:00 / 1:15'
    )
  })

  it('reads the length of a clip that loaded before it mounted', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(8)
    mount()

    await vi.waitFor(() =>
      expect(screen.getByTestId('cinematic-video-time')).toHaveTextContent(
        '0:00 / 0:08'
      )
    )
  })

  it('seeks from the scrubber', async () => {
    mount()
    lengthOf(clip(), 10)
    await fireEvent(clip(), new Event('loadedmetadata'))

    await fireEvent.update(screen.getByRole('slider', { name: 'Seek' }), '4')

    await vi.waitFor(() => expect(clip().currentTime).toBe(4))
  })

  it('turns the sound off and on', async () => {
    const { user } = mount()

    await user.click(screen.getByRole('button', { name: 'Turn sound off' }))
    await vi.waitFor(() => expect(clip().muted).toBe(true))

    await user.click(screen.getByRole('button', { name: 'Turn sound on' }))
    await vi.waitFor(() => expect(clip().muted).toBe(false))
  })

  it.for(['loadeddata', 'error'])(
    'tells the frame it has settled on %s',
    async (event) => {
      const { emitted } = mount()
      await fireEvent(clip(), new Event(event))
      expect(emitted('loaded')).toHaveLength(1)
    }
  )
})
