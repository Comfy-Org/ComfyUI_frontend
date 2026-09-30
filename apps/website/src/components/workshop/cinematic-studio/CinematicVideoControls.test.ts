import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'

import { tc } from '../../../lib/workshop/cinematic-studio/copy'
import type { CinematicVideoCapabilities } from '../../../lib/workshop/cinematic-studio/video'
import CinematicVideoControls from './CinematicVideoControls.vue'

const video: CinematicVideoCapabilities = {
  durations: [5, 10],
  defaultDuration: 5,
  resolutions: ['720p'],
  defaultResolution: '720p',
  aspects: ['16:9'],
  audioField: 'generate_audio',
  firstFrameRequired: false,
  firstFrameLinks: false,
  lastFrame: false,
  lastFrameLinks: false,
  sourceVideo: false
}

describe('CinematicVideoControls', () => {
  it('keeps the clip note behind an info button beside the audio toggle', async () => {
    render({
      setup: () => () =>
        h(CinematicVideoControls, {
          video,
          aspect: '16:9',
          duration: 5,
          audio: false
        })
    })
    const user = userEvent.setup()

    expect(
      screen.getByRole('switch', { name: tc('cinematic.video.audio') })
    ).toBeInTheDocument()
    expect(screen.queryByText(tc('cinematic.video.oneClip'))).toBeNull()

    await user.click(
      screen.getByRole('button', { name: tc('cinematic.video.about') })
    )
    expect(
      await screen.findByText(tc('cinematic.video.oneClip'))
    ).toBeInTheDocument()
  })
})
