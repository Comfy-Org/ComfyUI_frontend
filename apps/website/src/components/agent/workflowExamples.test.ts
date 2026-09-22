import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MockInstance } from 'vitest'

import { stubIntersectionObserver } from '../../test/fakeIntersectionObserver'
import { WorkflowExamples } from './workflowExamples'

customElements.define('test-workflow-examples', WorkflowExamples)

function controlMedia() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const desktop = window.matchMedia('(min-width: 1024px)')
  const reducedMatches = vi
    .spyOn(reduced, 'matches', 'get')
    .mockReturnValue(false)
  const desktopMatches = vi
    .spyOn(desktop, 'matches', 'get')
    .mockReturnValue(true)
  vi.stubGlobal('matchMedia', (query: string) =>
    query.includes('reduced-motion') ? reduced : desktop
  )
  return {
    reduced(value: boolean) {
      reducedMatches.mockReturnValue(value)
      reduced.dispatchEvent(new Event('change'))
    },
    desktop(value: boolean) {
      desktopMatches.mockReturnValue(value)
      desktop.dispatchEvent(new Event('change'))
    }
  }
}

function mountExamples({ single = false } = {}) {
  const root = document.createElement('test-workflow-examples')
  const picker = single
    ? ''
    : `
    <fieldset>
      <legend>Choose a workflow example</legend>
      <label><input type="radio" name="workflow-example" value="peanut" checked>Product image</label>
      <label><input type="radio" name="workflow-example" value="conditioner">Product video</label>
    </fieldset>
    <div class="wf-example" data-example="peanut"><div class="wf-scene"></div></div>`
  root.innerHTML = `${picker}
    <div class="wf-example" data-example="conditioner">
      <div class="wf-scene" data-testid="video-scene">
        <div>
          <video aria-label="White product video" data-src="/white.mp4" poster="/white.webp" muted></video>
          <span class="wf-video-cue" data-testid="white-cue" aria-hidden="true"></span>
        </div>
        <div>
          <video aria-label="Gold product video" data-src="/gold.mp4" poster="/gold.webp" muted></video>
          <span class="wf-video-cue" data-testid="gold-cue" aria-hidden="true"></span>
        </div>
      </div>
    </div>`
  document.body.append(root)
  return root
}

function cue(type: 'animationstart' | 'animationiteration' = 'animationstart') {
  const event = new Event(type, { bubbles: true })
  Object.defineProperty(event, 'animationName', { value: 'wf-video-reveal' })
  screen.getByTestId('white-cue').dispatchEvent(event)
}

describe('workflow example playback', () => {
  let media: ReturnType<typeof controlMedia>
  let observers: ReturnType<typeof stubIntersectionObserver>
  let play: MockInstance<HTMLVideoElement['play']>
  let pause: MockInstance<HTMLVideoElement['pause']>
  let root: HTMLElement | undefined
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    media = controlMedia()
    observers = stubIntersectionObserver()
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    play = vi
      .spyOn(HTMLVideoElement.prototype, 'play')
      .mockResolvedValue(undefined)
    pause = vi
      .spyOn(HTMLVideoElement.prototype, 'pause')
      .mockImplementation(() => {})
  })

  afterEach(() => {
    root?.remove()
    root = undefined
  })

  it('plays the sole workflow without a picker and resumes queued output after an offscreen pause', () => {
    root = mountExamples({ single: true })
    observers.instances[0].intersect(true)
    const video = screen.getByLabelText<HTMLVideoElement>('White product video')

    expect(screen.queryByRole('radio')).toBeNull()
    expect(video.hasAttribute('src')).toBe(false)
    expect(play).not.toHaveBeenCalled()

    observers.instances[0].intersect(false)
    cue()
    expect(play).not.toHaveBeenCalled()
    observers.instances[0].intersect(true)

    expect(video.getAttribute('src')).toBe('/white.mp4')
    expect(play).toHaveBeenCalledTimes(1)

    video.currentTime = 3
    observers.instances[0].intersect(false)
    observers.instances[0].intersect(true)

    expect(video.currentTime).toBe(3)
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('loads and starts the selected video only when its output is revealed', async () => {
    root = mountExamples()
    await user.click(screen.getByRole('radio', { name: 'Product video' }))
    observers.instances[0].intersect(true)
    const video = screen.getByLabelText<HTMLVideoElement>('White product video')

    expect(video.hasAttribute('src')).toBe(false)
    expect(play).not.toHaveBeenCalled()

    video.currentTime = 6
    cue()

    expect(video.getAttribute('src')).toBe('/white.mp4')
    expect(video.currentTime).toBe(0)
    expect(video.muted).toBe(true)
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('ignores a queued reveal event from the inactive example', () => {
    root = mountExamples()
    observers.instances[0].intersect(true)
    cue()

    expect(
      screen.getByLabelText('White product video').hasAttribute('src')
    ).toBe(false)
    expect(play).not.toHaveBeenCalled()
  })

  it('pauses offscreen and resumes the revealed video without rewinding it', async () => {
    root = mountExamples()
    await user.click(screen.getByRole('radio', { name: 'Product video' }))
    observers.instances[0].intersect(true)
    cue()
    const video = screen.getByLabelText<HTMLVideoElement>('White product video')
    video.currentTime = 4
    play.mockClear()
    pause.mockClear()

    observers.instances[0].intersect(false)
    cue('animationiteration')

    expect(root.hasAttribute('data-paused')).toBe(true)
    expect(pause).toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
    expect(video.currentTime).toBe(4)

    observers.instances[0].intersect(true)

    expect(root.hasAttribute('data-paused')).toBe(false)
    expect(play).toHaveBeenCalledTimes(1)
    expect(video.currentTime).toBe(4)
  })

  it('starts a queued reveal once when the workflow returns to view', async () => {
    root = mountExamples()
    await user.click(screen.getByRole('radio', { name: 'Product video' }))
    observers.instances[0].intersect(true)
    const video = screen.getByLabelText<HTMLVideoElement>('White product video')
    video.currentTime = 6

    observers.instances[0].intersect(false)
    cue()

    expect(video.hasAttribute('src')).toBe(false)
    expect(play).not.toHaveBeenCalled()
    expect(video.currentTime).toBe(6)

    observers.instances[0].intersect(true)

    expect(video.getAttribute('src')).toBe('/white.mp4')
    expect(video.currentTime).toBe(0)
    expect(play).toHaveBeenCalledTimes(1)

    video.currentTime = 3
    observers.instances[0].intersect(false)
    observers.instances[0].intersect(true)

    expect(video.currentTime).toBe(3)
    expect(play).toHaveBeenCalledTimes(2)
  })

  it.for([
    {
      name: 'the workflow loop restarts',
      reset: () => {
        screen
          .getByTestId('video-scene')
          .dispatchEvent(new Event('animationiteration', { bubbles: true }))
      }
    },
    {
      name: 'the selected example changes',
      reset: async () => {
        await user.click(screen.getByRole('radio', { name: 'Product image' }))
        await user.click(screen.getByRole('radio', { name: 'Product video' }))
      }
    },
    {
      name: 'reduced motion resets the animation',
      reset: () => {
        media.reduced(true)
        media.reduced(false)
      }
    },
    {
      name: 'a mobile viewport resets the animation',
      reset: () => {
        media.desktop(false)
        media.desktop(true)
      }
    }
  ])('discards a queued reveal when $name', async ({ reset }) => {
    root = mountExamples()
    await user.click(screen.getByRole('radio', { name: 'Product video' }))
    observers.instances[0].intersect(true)
    observers.instances[0].intersect(false)
    cue()

    await reset()
    observers.instances[0].intersect(true)

    expect(play).not.toHaveBeenCalled()
    expect(
      screen.getByLabelText('White product video').hasAttribute('src')
    ).toBe(false)

    cue()
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('waits for a fresh output cue after switching away from and back to the video example', async () => {
    root = mountExamples()
    await user.click(screen.getByRole('radio', { name: 'Product video' }))
    observers.instances[0].intersect(true)
    cue()
    play.mockClear()
    pause.mockClear()

    await user.click(screen.getByRole('radio', { name: 'Product image' }))
    await user.click(screen.getByRole('radio', { name: 'Product video' }))

    expect(pause).toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
    expect(screen.getByRole('radio', { name: 'Product video' })).toHaveProperty(
      'checked',
      true
    )
    expect(root.hasAttribute('data-paused')).toBe(false)
    expect(screen.getByRole('radio', { name: 'Product image' })).toHaveProperty(
      'checked',
      false
    )

    cue()
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('keeps the static poster under reduced motion without loading or playing video', async () => {
    media.reduced(true)
    root = mountExamples()
    await user.click(screen.getByRole('radio', { name: 'Product video' }))
    observers.instances[0].intersect(true)
    cue()
    const video = screen.getByLabelText<HTMLVideoElement>('White product video')

    expect(root.hasAttribute('data-paused')).toBe(true)
    expect(video.hasAttribute('src')).toBe(false)
    expect(video.getAttribute('poster')).toBe('/white.webp')
    expect(play).not.toHaveBeenCalled()
  })

  it.for([
    {
      name: 'reduced motion',
      stop: (media: ReturnType<typeof controlMedia>) => media.reduced(true),
      restart: (media: ReturnType<typeof controlMedia>) => media.reduced(false)
    },
    {
      name: 'a mobile viewport',
      stop: (media: ReturnType<typeof controlMedia>) => media.desktop(false),
      restart: (media: ReturnType<typeof controlMedia>) => media.desktop(true)
    }
  ])(
    'waits for a new output cue when $name cancels and restarts the CSS animation',
    async ({ stop, restart }) => {
      root = mountExamples()
      await user.click(screen.getByRole('radio', { name: 'Product video' }))
      observers.instances[0].intersect(true)
      cue()
      play.mockClear()

      stop(media)
      restart(media)

      expect(play).not.toHaveBeenCalled()

      cue()
      expect(play).toHaveBeenCalledTimes(1)
    }
  )

  it('pauses a hidden document and resumes at the same playback position', async () => {
    root = mountExamples()
    await user.click(screen.getByRole('radio', { name: 'Product video' }))
    observers.instances[0].intersect(true)
    cue()
    const video = screen.getByLabelText<HTMLVideoElement>('White product video')
    video.currentTime = 3
    play.mockClear()

    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(root.hasAttribute('data-paused')).toBe(true)
    expect(play).not.toHaveBeenCalled()

    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))

    expect(play).toHaveBeenCalledTimes(1)
    expect(video.currentTime).toBe(3)
  })

  it('rewinds to the opening frame when the output cue repeats on the next loop', async () => {
    root = mountExamples()
    await user.click(screen.getByRole('radio', { name: 'Product video' }))
    observers.instances[0].intersect(true)
    cue()
    const video = screen.getByLabelText<HTMLVideoElement>('White product video')
    video.currentTime = 9
    play.mockClear()

    cue('animationiteration')

    expect(video.currentTime).toBe(0)
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('stops playback through the next workflow intro until the output is generated again', async () => {
    root = mountExamples()
    await user.click(screen.getByRole('radio', { name: 'Product video' }))
    observers.instances[0].intersect(true)
    cue()
    play.mockClear()
    pause.mockClear()

    screen
      .getByTestId('video-scene')
      .dispatchEvent(new Event('animationiteration', { bubbles: true }))
    observers.instances[0].intersect(false)
    observers.instances[0].intersect(true)

    expect(pause).toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()

    cue('animationiteration')
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('keeps the ending frame when a completed video returns to view', async () => {
    root = mountExamples()
    await user.click(screen.getByRole('radio', { name: 'Product video' }))
    observers.instances[0].intersect(true)
    cue()
    const video = screen.getByLabelText<HTMLVideoElement>('White product video')
    vi.spyOn(video, 'ended', 'get').mockReturnValue(true)
    play.mockClear()

    observers.instances[0].intersect(false)
    observers.instances[0].intersect(true)

    expect(play).not.toHaveBeenCalled()
  })

  it('disconnects observers and playback listeners when removed', async () => {
    root = mountExamples()
    await user.click(screen.getByRole('radio', { name: 'Product video' }))
    observers.instances[0].intersect(true)
    cue()
    const disconnect = vi.spyOn(observers.instances[0], 'disconnect')
    const cueElement = screen.getByTestId('white-cue')
    play.mockClear()
    pause.mockClear()

    root.remove()
    cueElement.dispatchEvent(new Event('animationiteration', { bubbles: true }))
    media.reduced(true)
    media.reduced(false)

    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(pause).toHaveBeenCalled()
    expect(play).not.toHaveBeenCalled()
  })
})
