// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import ModelLaunchHeroSection from '../templates/model-launch/ModelLaunchHeroSection.vue'
import { wan3Page } from './wan3'

// The Wan 3.0 hero clip is ~10 MB against a ~4 MB mobile encode and a ~370 KB
// still. ModelLaunchHeroSection mounts the full clip only at >=768px; below
// that it plays mobileVideoSrc, and the still covers SSR before the player
// mounts. These tests pin which src reaches the <video> on each side of the
// breakpoint, so phones never fetch the full clip.
const DESKTOP_WIDTH = 1280
const MOBILE_WIDTH = 375

// happy-dom hangs setViewport off window.happyDOM, which the DOM lib types
// this project compiles against know nothing about.
const happyWindow = window as typeof window & {
  happyDOM: { setViewport: (viewport: { width: number }) => void }
}

function setViewportWidth(width: number) {
  happyWindow.happyDOM.setViewport({ width })
}

// The video swaps in only after onMounted flips useMounted, a tick past render.
function flushMount() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function renderHero() {
  render(ModelLaunchHeroSection, { props: { hero: wan3Page.hero } })
  return flushMount()
}

function renderedVideoSrc() {
  // <video> carries no implicit ARIA role, so Testing Library queries cannot
  // reach it and the src assertion has to touch the node directly.
  // eslint-disable-next-line testing-library/no-node-access
  const videos = document.querySelectorAll('video')
  expect(videos.length).toBe(1)
  return videos[0].getAttribute('src')
}

afterEach(() => {
  cleanup()
  setViewportWidth(DESKTOP_WIDTH)
})

describe('wan 3.0 hero media', () => {
  it('configures a mobile encode distinct from the full clip', () => {
    expect(wan3Page.hero.mobileVideoSrc).toMatch(
      /^https:\/\/media\.comfy\.org\/.+\.mp4$/
    )
    expect(wan3Page.hero.mobileVideoSrc).not.toBe(wan3Page.hero.videoSrc)
  })

  it('keeps the still configured so SSR renders it before the player mounts', () => {
    expect(wan3Page.hero.mobileFallbackImageSrc).toMatch(
      /^https:\/\/media\.comfy\.org\/.+\.(webp|png|jpe?g)$/
    )
  })

  it('plays the mobile encode, not the full clip, on a phone-sized viewport', async () => {
    setViewportWidth(MOBILE_WIDTH)

    await renderHero()

    expect(renderedVideoSrc()).toBe(wan3Page.hero.mobileVideoSrc)
  })

  it('plays the full clip on a desktop viewport', async () => {
    setViewportWidth(DESKTOP_WIDTH)

    await renderHero()

    expect(renderedVideoSrc()).toBe(wan3Page.hero.videoSrc)
  })
})
