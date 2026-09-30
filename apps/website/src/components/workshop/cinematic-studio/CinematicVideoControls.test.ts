import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { h, ref } from 'vue'

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
  it('switches generated audio from a chip beside the format menus', async () => {
    const audio = ref(false)
    render({
      setup: () => () =>
        h(CinematicVideoControls, {
          video,
          aspect: '16:9',
          duration: 5,
          audio: audio.value,
          'onUpdate:audio': (next: boolean) => {
            audio.value = next
          }
        })
    })
    const user = userEvent.setup()
    const toggle = screen.getByRole('switch', {
      name: tc('cinematic.video.audio')
    })

    expect(toggle).not.toBeChecked()
    expect(toggle).toHaveTextContent(tc('cinematic.video.audioOff'))
    expect(screen.queryByText(tc('cinematic.video.audioHint'))).toBeNull()

    await user.click(toggle)
    expect(audio.value).toBe(true)
    expect(toggle).toBeChecked()
    expect(toggle).toHaveTextContent(tc('cinematic.video.audioOn'))
  })
})
