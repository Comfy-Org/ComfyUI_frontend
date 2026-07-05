import { render } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import { useReleaseMediaOnUnmount } from './useReleaseMediaOnUnmount'

/**
 * Renders a component that wires the composable to a media element, so we can
 * assert the teardown that `<video>`/`<audio>` need on iOS Safari.
 */
function mountWithMedia(el: HTMLMediaElement | null) {
  const elementRef = ref(el)
  return render(
    defineComponent({
      setup() {
        useReleaseMediaOnUnmount(elementRef)
        return () => h('div')
      }
    })
  )
}

function createVideoWithSources(count: number) {
  const video = document.createElement('video')
  for (let i = 0; i < count; i++) {
    video.append(document.createElement('source'))
  }
  return video
}

describe('useReleaseMediaOnUnmount', () => {
  it('pauses, clears the source, and reloads the element on unmount', () => {
    const video = createVideoWithSources(1)
    video.setAttribute('src', 'blob:example')
    const pause = vi.spyOn(video, 'pause')
    const load = vi.spyOn(video, 'load')

    const { unmount } = mountWithMedia(video)
    expect(pause).not.toHaveBeenCalled()

    unmount()

    expect(pause).toHaveBeenCalledOnce()
    expect(video.hasAttribute('src')).toBe(false)
    expect(video).toBeEmptyDOMElement()
    expect(load).toHaveBeenCalledOnce()
  })

  it('removes every nested <source> child so load() drops the buffer', () => {
    const video = createVideoWithSources(2)

    mountWithMedia(video).unmount()

    expect(video).toBeEmptyDOMElement()
  })

  it('is a no-op when the element ref is empty', () => {
    expect(() => mountWithMedia(null).unmount()).not.toThrow()
  })
})
