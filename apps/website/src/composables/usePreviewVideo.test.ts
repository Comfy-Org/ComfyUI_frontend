// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import {
  FakeIntersectionObserver,
  setAllIntersecting,
  stubIntersectionObserver
} from '../test/fakeIntersectionObserver'
import { usePreviewVideo } from './usePreviewVideo'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock(import('./useReducedMotion'), () => ({
  prefersReducedMotion: () => motion.reduced
}))

const URL = 'https://assets.example/preview.mp4'

const Preview = defineComponent({
  props: {
    url: { type: String, default: URL },
    visible: { type: Boolean, default: undefined },
    /** Re-keys the element, the way the banner swaps one video per slide. */
    slide: { type: String, default: 'a' }
  },
  setup(props) {
    const video = ref<HTMLVideoElement | null>(null)
    const src = usePreviewVideo(
      video,
      () => props.url,
      props.visible === undefined
        ? {}
        : { visible: () => props.visible === true }
    )
    return () =>
      h('video', {
        key: props.slide,
        ref: video,
        src: src.value,
        'data-testid': 'preview'
      })
  }
})

function setTabVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state)
  document.dispatchEvent(new Event('visibilitychange'))
}

async function settle() {
  await nextTick()
  await nextTick()
}

describe('usePreviewVideo', () => {
  let play: ReturnType<typeof vi.spyOn>
  let pause: ReturnType<typeof vi.spyOn>
  let load: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    motion.reduced = false
    stubIntersectionObserver()
    play = vi.spyOn(HTMLMediaElement.prototype, 'play')
    pause = vi.spyOn(HTMLMediaElement.prototype, 'pause')
    load = vi.spyOn(HTMLMediaElement.prototype, 'load')
  })

  afterEach(async () => {
    setTabVisibility('visible')
    await settle()
  })

  it('keeps an offscreen preview unloaded and does not touch a never-loaded element', async () => {
    render(Preview)
    await settle()
    expect(screen.getByTestId('preview')).not.toHaveAttribute('src')
    expect(play).not.toHaveBeenCalled()
    expect(load).not.toHaveBeenCalled()
  })

  it('attaches the source and plays once the preview is on screen', async () => {
    render(Preview)
    await setAllIntersecting(true)
    expect(screen.getByTestId('preview')).toHaveAttribute('src', URL)
    expect(play).toHaveBeenCalledOnce()
  })

  it('pauses and gives the buffer back when the preview scrolls away', async () => {
    render(Preview)
    await setAllIntersecting(true)
    await setAllIntersecting(false)
    expect(screen.getByTestId('preview')).not.toHaveAttribute('src')
    expect(pause).toHaveBeenCalled()
    expect(load).toHaveBeenCalledOnce()
  })

  it('only pauses in a hidden tab, then resumes in place', async () => {
    render(Preview)
    await setAllIntersecting(true)
    setTabVisibility('hidden')
    await settle()
    expect(screen.getByTestId('preview')).toHaveAttribute('src', URL)
    expect(pause).toHaveBeenCalled()
    expect(load).not.toHaveBeenCalled()
    setTabVisibility('visible')
    await settle()
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('loads but never plays when reduced motion is preferred', async () => {
    motion.reduced = true
    render(Preview)
    await setAllIntersecting(true)
    expect(screen.getByTestId('preview')).toHaveAttribute('src', URL)
    expect(play).not.toHaveBeenCalled()
    expect(screen.getByTestId<HTMLVideoElement>('preview').paused).toBe(true)
  })

  it('follows an injected gate instead of observing the element itself', async () => {
    const { rerender } = render(Preview, { props: { visible: false } })
    await settle()
    expect(FakeIntersectionObserver.instances).toHaveLength(0)
    expect(screen.getByTestId('preview')).not.toHaveAttribute('src')
    await rerender({ visible: true })
    await settle()
    expect(screen.getByTestId('preview')).toHaveAttribute('src', URL)
    expect(play).toHaveBeenCalledOnce()
  })

  it('releases the outgoing element when a keyed video is swapped', async () => {
    const { rerender } = render(Preview, { props: { visible: true } })
    await settle()
    const first = screen.getByTestId<HTMLVideoElement>('preview')
    expect(first).toHaveAttribute('src', URL)
    await rerender({ visible: true, slide: 'b' })
    await settle()
    const second = screen.getByTestId<HTMLVideoElement>('preview')
    expect(second).not.toBe(first)
    expect(first).not.toHaveAttribute('src')
    expect(load).toHaveBeenCalledOnce()
    expect(second).toHaveAttribute('src', URL)
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('releases the media on unmount', async () => {
    const { unmount } = render(Preview)
    await setAllIntersecting(true)
    const video = screen.getByTestId('preview')
    unmount()
    expect(pause).toHaveBeenCalled()
    expect(video).not.toHaveAttribute('src')
    expect(load).toHaveBeenCalledOnce()
  })
})
