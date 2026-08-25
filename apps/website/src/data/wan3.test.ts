// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it } from 'vitest'

import ModelLaunchHeroSection from '../templates/model-launch/ModelLaunchHeroSection.vue'
import { wan3Page } from './wan3'

// The Wan 3.0 hero clip is ~25 MB against a ~370 KB still. ModelLaunchHeroSection
// mounts <video> only at >=768px *and* only when a fallback still is configured;
// drop the fallback and the gate opens for every viewport, so phones fetch the
// clip. These tests pin both halves of that gate.
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

// <video> carries no implicit ARIA role, so the player is detected through its
// scrubber — VideoPlayer renders the control bar whenever it renders the video.
function queryVideoPlayer() {
  return screen.queryByRole('slider', { name: 'Seek' })
}

function renderHero() {
  render(ModelLaunchHeroSection, { props: { hero: wan3Page.hero } })
  return flushMount()
}

afterEach(() => {
  setViewportWidth(DESKTOP_WIDTH)
})

describe('wan 3.0 hero media', () => {
  it('configures a still image for phones to render instead of the clip', () => {
    expect(wan3Page.hero.mobileFallbackImageSrc).toMatch(
      /^https:\/\/media\.comfy\.org\/.+\.(webp|png|jpe?g)$/
    )
  })

  it('renders the still and no video player on a phone-sized viewport', async () => {
    setViewportWidth(MOBILE_WIDTH)

    await renderHero()

    // Asserted on the src, not just on the absence of a player, so a missing
    // fallback fails here rather than passing on a hero with no media at all.
    const still = screen.getByRole('img', { hidden: true })
    expect(still.getAttribute('src')).toBe(wan3Page.hero.mobileFallbackImageSrc)
    expect(queryVideoPlayer()).toBeNull()
  })

  it('still renders the video player on a desktop viewport', async () => {
    setViewportWidth(DESKTOP_WIDTH)

    await renderHero()

    expect(queryVideoPlayer()).not.toBeNull()
    expect(screen.queryByRole('img', { hidden: true })).toBeNull()
  })
})
