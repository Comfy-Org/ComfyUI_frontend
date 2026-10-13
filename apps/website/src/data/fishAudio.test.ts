import { cleanup, render } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import ModelLaunchHeroSection from '@/templates/model-launch/ModelLaunchHeroSection.vue'
import { fishAudioPage } from './fishAudio'

// The Fish Audio hero clip is ~5.4 MB with no separate mobile encode, so the
// page opts into the poster still below the 768px breakpoint: phones (and the
// SSR pass) never fetch the video at all. That opt-in existed in #20898 and
// was dropped by an unrelated rewrite of the data file mid-PR (#20932); these
// tests pin which media reaches the DOM on each side of the breakpoint.
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
  render(ModelLaunchHeroSection, { props: { hero: fishAudioPage.hero } })
  return flushMount()
}

afterEach(() => {
  cleanup()
  setViewportWidth(DESKTOP_WIDTH)
})

describe('fish audio hero media', () => {
  it('opts into the mobile still, which suppresses the video below the breakpoint', () => {
    expect(fishAudioPage.hero.mobileFallbackImageSrc).toBe(
      fishAudioPage.hero.posterSrc
    )
  })

  it('renders no video element at all on a phone-sized viewport', async () => {
    setViewportWidth(MOBILE_WIDTH)

    await renderHero()

    // <video> carries no implicit ARIA role, so Testing Library queries cannot
    // reach it and the src assertion has to touch the node directly.
    // oxlint-disable-next-line testing-library/no-node-access
    expect(document.querySelectorAll('video')).toHaveLength(0)
  })

  it('plays the full clip on a desktop viewport', async () => {
    setViewportWidth(DESKTOP_WIDTH)

    await renderHero()

    // oxlint-disable-next-line testing-library/no-node-access
    const videos = document.querySelectorAll('video')
    expect(videos).toHaveLength(1)
    expect(videos[0].getAttribute('src')).toBe(fishAudioPage.hero.videoSrc)
  })
})
