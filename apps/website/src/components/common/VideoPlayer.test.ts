// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import VideoPlayer from './VideoPlayer.vue'

describe('VideoPlayer', () => {
  // A server-rendered autoplay video can already be playing (and muted) when
  // hydration binds the element, after its play/volumechange events fired.
  // The element-bind watcher must sync the controls to that reality.
  it('syncs the corner controls with a video already playing muted when the element binds', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockReturnValue(false)
    vi.spyOn(HTMLMediaElement.prototype, 'muted', 'get').mockReturnValue(true)

    render(VideoPlayer, {
      props: {
        locale: 'en',
        src: 'https://example.com/clip.mp4',
        muteOnly: true
      }
    })

    expect(await screen.findByRole('button', { name: 'Pause' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Unmute' })).toBeTruthy()
  })

  it('shows play and mute for a paused, unmuted video', async () => {
    render(VideoPlayer, {
      props: {
        locale: 'en',
        src: 'https://example.com/clip.mp4',
        muteOnly: true
      }
    })

    expect(await screen.findByRole('button', { name: 'Play' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mute' })).toBeTruthy()
  })
})
