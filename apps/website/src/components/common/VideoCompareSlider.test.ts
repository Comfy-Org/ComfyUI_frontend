import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h, nextTick, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

import VideoCompareSlider from './VideoCompareSlider.vue'

import { stubIntersectionObserver } from '@/test/fakeIntersectionObserver'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock(import('@/composables/useReducedMotion'), () => ({
  prefersReducedMotion: () => motion.reduced
}))

const props = {
  beforeSrc: 'before.webm',
  afterSrc: 'after.webm',
  beforeLabel: 'Before',
  afterLabel: 'After',
  sliderLabel: 'Comparison slider'
}

async function renderSlider(extraProps = {}) {
  render(VideoCompareSlider, { props: { ...props, ...extraProps } })
  const slider = screen.getByRole('slider', { name: 'Comparison slider' })
  const surface = screen.getByTestId('video-compare-surface')
  const beforeVideo = screen.getByTestId<HTMLVideoElement>(
    'video-compare-before'
  )
  const afterVideo = screen.getByTestId<HTMLVideoElement>('video-compare-after')
  await nextTick()
  return { slider, surface, beforeVideo, afterVideo }
}

async function renderVisibleMetadataSlider() {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  const observers = stubIntersectionObserver()
  const { surface, beforeVideo, afterVideo } = await renderSlider({
    synchronizedPlayback: true
  })
  const observer = observers.instances[0]
  assert.exists(observer)
  const bounds = new DOMRect(0, 0, 400, 225)
  observer.callback(
    [
      {
        target: surface,
        boundingClientRect: bounds,
        intersectionRect: bounds,
        rootBounds: null,
        isIntersecting: true,
        intersectionRatio: 1,
        time: 0
      }
    ],
    new IntersectionObserver(() => undefined)
  )
  await nextTick()
  vi.spyOn(beforeVideo, 'readyState', 'get').mockReturnValue(1)
  vi.spyOn(beforeVideo, 'duration', 'get').mockReturnValue(8)
  beforeVideo.dispatchEvent(new Event('loadedmetadata'))
  vi.spyOn(afterVideo, 'readyState', 'get').mockReturnValue(1)
  vi.spyOn(afterVideo, 'duration', 'get').mockReturnValue(8)
  afterVideo.dispatchEvent(new Event('loadedmetadata'))
  return { beforeVideo, afterVideo }
}

async function pressAt(
  user: ReturnType<typeof userEvent.setup>,
  surface: HTMLElement,
  clientX: number,
  keys = '[MouseLeft>]'
) {
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(100, 0, 400, 225)
  )
  await user.pointer([{ keys, target: surface, coords: { clientX } }])
}

describe('VideoCompareSlider', () => {
  it('defers synchronized sources until first visibility and retains them afterward', async () => {
    const observers = stubIntersectionObserver()
    const { surface, beforeVideo, afterVideo } = await renderSlider({
      synchronizedPlayback: true
    })
    const observer = observers.instances[0]
    assert.exists(observer)
    const bounds = new DOMRect(0, 0, 400, 225)
    const entry = {
      target: surface,
      boundingClientRect: bounds,
      intersectionRect: bounds,
      rootBounds: null,
      isIntersecting: true,
      intersectionRatio: 0.24,
      time: 0
    }
    const nativeObserver = new IntersectionObserver(() => undefined)
    expect(beforeVideo).not.toHaveAttribute('src')
    expect(afterVideo).not.toHaveAttribute('src')
    expect(beforeVideo).toHaveAttribute('preload', 'none')
    expect(afterVideo).toHaveAttribute('preload', 'none')

    observer.callback([entry], nativeObserver)
    await nextTick()
    expect(beforeVideo).not.toHaveAttribute('src')
    expect(afterVideo).not.toHaveAttribute('src')

    observer.callback([{ ...entry, intersectionRatio: 0.25 }], nativeObserver)
    await waitFor(() => {
      expect(beforeVideo).toHaveAttribute('src', 'before.webm')
      expect(afterVideo).toHaveAttribute('src', 'after.webm')
    })
    expect(beforeVideo).toHaveAttribute('preload', 'auto')
    expect(afterVideo).toHaveAttribute('preload', 'auto')
    expect(beforeVideo.autoplay).toBe(false)
    expect(afterVideo.autoplay).toBe(false)
    expect(beforeVideo.muted).toBe(true)
    expect(afterVideo.muted).toBe(true)

    observer.callback(
      [{ ...entry, isIntersecting: false, intersectionRatio: 0 }],
      nativeObserver
    )
    await nextTick()
    expect(beforeVideo).toHaveAttribute('src', 'before.webm')
    expect(afterVideo).toHaveAttribute('src', 'after.webm')
    expect(beforeVideo).toHaveAttribute('preload', 'auto')
    expect(afterVideo).toHaveAttribute('preload', 'auto')
  })

  it('seeks both paused synchronized clips when their shared time changes', async () => {
    const time = ref(0)
    render(
      defineComponent({
        setup: () => () =>
          h(VideoCompareSlider, {
            ...props,
            synchronizedPlayback: true,
            paused: true,
            time: time.value,
            'onUpdate:time': (value: number) => {
              time.value = value
            }
          })
      })
    )
    const beforeVideo = screen.getByTestId<HTMLVideoElement>(
      'video-compare-before'
    )
    const afterVideo = screen.getByTestId<HTMLVideoElement>(
      'video-compare-after'
    )
    vi.spyOn(beforeVideo, 'duration', 'get').mockReturnValue(4.5)
    vi.spyOn(afterVideo, 'duration', 'get').mockReturnValue(4.5)
    time.value = 1.25
    await waitFor(() => {
      expect(beforeVideo.currentTime).toBe(1.25)
      expect(afterVideo.currentTime).toBe(1.25)
    })
    expect(beforeVideo.paused).toBe(true)
    expect(afterVideo.paused).toBe(true)
  })

  it('starts visible clips when only metadata is loaded', async () => {
    const { beforeVideo, afterVideo } = await renderVisibleMetadataSlider()
    await waitFor(() => {
      expect(beforeVideo.paused).toBe(false)
      expect(afterVideo.paused).toBe(false)
    })
  })

  it('keeps both playing when the after clip waits for data', async () => {
    const { beforeVideo, afterVideo } = await renderVisibleMetadataSlider()
    await waitFor(() => expect(afterVideo.paused).toBe(false))
    afterVideo.dispatchEvent(new Event('waiting'))
    await nextTick()
    expect(beforeVideo.paused).toBe(false)
    expect(afterVideo.paused).toBe(false)
  })

  it('corrects drift only after the after clip finishes seeking', async () => {
    const { beforeVideo, afterVideo } = await renderVisibleMetadataSlider()
    await waitFor(() => expect(afterVideo.paused).toBe(false))
    beforeVideo.currentTime = 2
    afterVideo.currentTime = 1
    const seeking = vi.spyOn(afterVideo, 'seeking', 'get').mockReturnValue(true)
    beforeVideo.dispatchEvent(new Event('timeupdate'))
    await nextTick()
    expect(afterVideo.currentTime).toBe(1)
    seeking.mockReturnValue(false)
    beforeVideo.dispatchEvent(new Event('timeupdate'))
    await nextTick()
    expect(afterVideo.currentTime).toBe(2)
  })

  it('tolerates small drift between synchronized clips', async () => {
    const { beforeVideo, afterVideo } = await renderVisibleMetadataSlider()
    await waitFor(() => expect(afterVideo.paused).toBe(false))
    beforeVideo.currentTime = 2
    afterVideo.currentTime = 1.85
    beforeVideo.dispatchEvent(new Event('timeupdate'))
    await nextTick()
    expect(afterVideo.currentTime).toBe(1.85)
  })

  it('starts observing when synchronized playback is enabled after mounting', async () => {
    const observers = stubIntersectionObserver()
    const enabled = ref(false)
    render(
      defineComponent({
        setup: () => () =>
          h(VideoCompareSlider, {
            ...props,
            synchronizedPlayback: enabled.value
          })
      })
    )
    await nextTick()
    expect(observers.instances).toHaveLength(0)
    enabled.value = true
    await nextTick()
    await nextTick()
    expect(observers.instances[0]?.observed).toContain(
      screen.getByTestId('video-compare-surface')
    )
  })

  beforeEach(() => {
    vi.stubGlobal(
      'HTMLMediaElement',
      class extends HTMLMediaElement {
        static override readonly HAVE_METADATA = 1
      }
    )
    motion.reduced = false
  })

  it('reveals either reference image with keyboard controls', async () => {
    const user = userEvent.setup()
    render(VideoCompareSlider, {
      props: {
        ...props,
        mediaKind: 'image',
        beforeSrc: '/before.jpg',
        afterSrc: '/after.jpg'
      }
    })
    expect(screen.getByRole('img', { name: 'Before' })).toHaveAttribute(
      'src',
      '/before.jpg'
    )
    const after = screen.getByRole('img', { name: 'After' })
    expect(after).toHaveAttribute('src', '/after.jpg')
    expect(after.style.clipPath).toBe('inset(0 0 0 50%)')
    const slider = screen.getByRole('slider', { name: 'Comparison slider' })
    slider.focus()
    await user.keyboard('{Home}')
    expect(slider).toHaveAttribute('aria-valuenow', '0')
    expect(after.style.clipPath).toBe('inset(0 0 0 0%)')
    await user.keyboard('{End}')
    expect(slider).toHaveAttribute('aria-valuenow', '100')
    expect(after.style.clipPath).toBe('inset(0 0 0 100%)')
  })

  it('renders no clip sources on the server', async () => {
    const html = await renderToString(
      createSSRApp({ render: () => h(VideoCompareSlider, props) })
    )

    expect(html).toContain('role="slider"')
    expect(html).not.toContain('before.webm')
    expect(html).not.toContain('after.webm')
  })

  it('starts at the midpoint with the after clip revealed on the right', async () => {
    const { slider, beforeVideo, afterVideo } = await renderSlider()

    expect(beforeVideo).toHaveAttribute('src', 'before.webm')
    expect(beforeVideo).toHaveAttribute('preload', 'none')
    expect(afterVideo).toHaveAttribute('preload', 'none')
    expect(afterVideo).toHaveAttribute('src', 'after.webm')
    expect(slider).toHaveAttribute('aria-valuenow', '50')
    expect(afterVideo.style.clipPath).toBe('inset(0 0 0 50%)')
    expect(screen.getByText('Before')).toBeVisible()
    expect(screen.getByText('After')).toBeVisible()
  })

  it.for([
    { preference: 'no preference', reduced: false, autoplays: true },
    { preference: 'reduced motion', reduced: true, autoplays: false }
  ])(
    'autoplays both clips: $autoplays, with $preference',
    async ({ reduced, autoplays }) => {
      motion.reduced = reduced
      const { beforeVideo, afterVideo } = await renderSlider()

      expect(beforeVideo.autoplay).toBe(autoplays)
      expect(afterVideo.autoplay).toBe(autoplays)
    }
  )

  it('shows each clip poster before the clips load', async () => {
    const { beforeVideo, afterVideo } = await renderSlider({
      beforePosterSrc: 'before.jpg',
      afterPosterSrc: 'after.jpg'
    })

    expect(beforeVideo).toHaveAttribute('poster', 'before.jpg')
    expect(afterVideo).toHaveAttribute('poster', 'after.jpg')
  })

  it('moves with the keyboard and clips the after clip to match', async () => {
    const user = userEvent.setup()
    const { slider, afterVideo } = await renderSlider()

    slider.focus()
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(slider).toHaveAttribute('aria-valuenow', '60')
    expect(afterVideo.style.clipPath).toBe('inset(0 0 0 60%)')

    await user.keyboard('{Home}')
    expect(slider).toHaveAttribute('aria-valuenow', '0')
  })

  it('jumps to the pressed point and follows the pointer while held', async () => {
    const user = userEvent.setup()
    const { slider, surface } = await renderSlider()

    await pressAt(user, surface, 200)
    expect(slider).toHaveAttribute('aria-valuenow', '25')

    await user.pointer([{ coords: { clientX: 400 } }])
    expect(slider).toHaveAttribute('aria-valuenow', '75')
  })

  it('ignores presses from other buttons', async () => {
    const user = userEvent.setup()
    const { slider, surface } = await renderSlider()

    await pressAt(user, surface, 200, '[MouseRight>]')
    await user.pointer([{ coords: { clientX: 400 } }])

    expect(slider).toHaveAttribute('aria-valuenow', '50')
  })

  it.for([
    { release: 'pointerup', event: () => new Event('pointerup') },
    { release: 'pointercancel', event: () => new Event('pointercancel') },
    {
      release: 'a move with no button held',
      event: () => new PointerEvent('pointermove', { clientX: 400, buttons: 0 })
    }
  ])('stops following the pointer after $release', async ({ event }) => {
    const user = userEvent.setup()
    const { slider, surface } = await renderSlider()
    await pressAt(user, surface, 200)

    window.dispatchEvent(event())
    await user.pointer([{ coords: { clientX: 400 } }])

    expect(slider).toHaveAttribute('aria-valuenow', '25')
  })

  it.for([
    { before: 4, after: 1, expected: 4 },
    { before: 4, after: 3.9, expected: 3.9 }
  ])(
    'puts the after clip at $expected when it is at $after and the before clip is at $before',
    async ({ before, after, expected }) => {
      const { beforeVideo, afterVideo } = await renderSlider()

      beforeVideo.currentTime = before
      afterVideo.currentTime = after
      beforeVideo.dispatchEvent(new Event('timeupdate'))

      expect(afterVideo.currentTime).toBe(expected)
    }
  )

  it('resumes the after clip when it has paused while the before clip plays', async () => {
    const { beforeVideo, afterVideo } = await renderSlider()
    vi.spyOn(beforeVideo, 'paused', 'get').mockReturnValue(false)
    vi.spyOn(afterVideo, 'paused', 'get').mockReturnValue(true)
    const play = vi.spyOn(afterVideo, 'play').mockResolvedValue()

    beforeVideo.dispatchEvent(new Event('timeupdate'))

    expect(play).toHaveBeenCalledOnce()
  })
})

function pointerCapabilities(fine: boolean, primaryFine = fine) {
  vi.spyOn(window, 'matchMedia').mockImplementation((media) =>
    Object.assign(new EventTarget(), {
      media,
      matches: media.includes('any-') ? fine : primaryFine,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn()
    })
  )
}

it.for([
  { scenario: 'mouse hover', clientX: 200, expected: '25', primaryFine: true },
  { scenario: 'left edge', clientX: 50, expected: '0', primaryFine: true },
  { scenario: 'right edge', clientX: 600, expected: '100', primaryFine: true },
  {
    scenario: 'mouse attached to a touch-first device',
    clientX: 200,
    expected: '25',
    primaryFine: false
  }
])(
  '$scenario follows to $expected without pressing or preventing scroll',
  async ({ clientX, expected, primaryFine }) => {
    pointerCapabilities(true, primaryFine)
    const { surface, slider } = await renderSlider({
      followPointerOnHover: true
    })
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(100, 0, 400, 225)
    )
    const event = new PointerEvent('pointermove', {
      pointerType: 'mouse',
      clientX,
      bubbles: true,
      cancelable: true
    })
    surface.dispatchEvent(event)
    await nextTick()
    expect(slider).toHaveAttribute('aria-valuenow', expected)
    expect(event.defaultPrevented).toBe(false)
  }
)

it.for([
  { enabled: false, fine: true, pointerType: 'mouse', buttons: 0 },
  { enabled: true, fine: false, pointerType: 'mouse', buttons: 0 },
  { enabled: true, fine: true, pointerType: 'touch', buttons: 0 },
  { enabled: true, fine: true, pointerType: 'mouse', buttons: 1 }
])(
  'does not hover-follow with $enabled/$fine/$pointerType/$buttons',
  async ({ enabled, fine, pointerType, buttons }) => {
    pointerCapabilities(fine)
    const { surface, slider } = await renderSlider({
      followPointerOnHover: enabled
    })
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(100, 0, 400, 225)
    )
    surface.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerType,
        buttons,
        clientX: 200,
        bubbles: true
      })
    )
    await nextTick()
    expect(slider).toHaveAttribute('aria-valuenow', '50')
  }
)

it('keeps touch dragging and keyboard adjustment when hover-follow is enabled', async () => {
  pointerCapabilities(false)
  const { surface, slider } = await renderSlider({ followPointerOnHover: true })
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(100, 0, 400, 225)
  )
  surface.dispatchEvent(
    new PointerEvent('pointerdown', {
      pointerType: 'touch',
      button: 0,
      buttons: 1,
      clientX: 200,
      bubbles: true
    })
  )
  window.dispatchEvent(
    new PointerEvent('pointermove', {
      pointerType: 'touch',
      buttons: 1,
      clientX: 400
    })
  )
  window.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch' }))
  await nextTick()
  expect(slider).toHaveAttribute('aria-valuenow', '75')
  slider.focus()
  await userEvent.setup().keyboard('{ArrowRight}')
  expect(slider).toHaveAttribute('aria-valuenow', '77')
})
