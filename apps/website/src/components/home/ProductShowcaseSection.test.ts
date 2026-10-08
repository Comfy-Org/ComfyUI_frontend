/* oxlint-disable testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { stubIntersectionObserver } from '@/test/fakeIntersectionObserver'
import ProductShowcaseSection from './ProductShowcaseSection.vue'

// The scene players are covered by their own suites; here only the slide
// wiring matters.
function renderSection() {
  return render(ProductShowcaseSection, {
    global: { stubs: { LottieScene: true, VideoMaskScene: true } }
  })
}

function sceneSources(): (string | null)[] {
  return [
    ...document.querySelectorAll('lottie-scene-stub, video-mask-scene-stub')
  ].map((el) => el.getAttribute('src'))
}

describe('ProductShowcaseSection', () => {
  beforeEach(() => {
    stubIntersectionObserver()
  })

  it('mounts the desktop stack plus a mobile copy of the active feature', () => {
    renderSection()

    // Desktop mounts all three scenes; mobile only the active (first) one.
    expect(document.querySelectorAll('lottie-scene-stub')).toHaveLength(3)
    expect(document.querySelectorAll('video-mask-scene-stub')).toHaveLength(1)
    expect(
      sceneSources().filter(
        (src) => src === '/animations/scene-1/scene-01.json'
      )
    ).toHaveLength(2)
  })

  it('switches the mobile scene to the selected feature', async () => {
    renderSection()

    screen.getByRole('button', { name: /Community Workflows/i }).click()
    await nextTick()

    expect(
      sceneSources().filter(
        (src) => src === '/animations/scene-3/scene-03.json'
      )
    ).toHaveLength(2)
    expect(
      sceneSources().filter(
        (src) => src === '/animations/scene-1/scene-01.json'
      )
    ).toHaveLength(1)
  })

  it('renders supplied prizes and switches the expanded award', async () => {
    render(ProductShowcaseSection, {
      props: {
        heading: 'Challenge prizes',
        features: [
          { title: 'Most practical', description: 'A useful working app' },
          { title: 'Most entertaining', description: 'A delightful demo' }
        ]
      },
      slots: { media: '<p>Grand prize: $10,000</p>' },
      global: { stubs: { LottieScene: true, VideoMaskScene: true } }
    })

    expect(
      screen.getByRole('heading', { name: 'Challenge prizes' })
    ).toBeVisible()
    expect(screen.getAllByText('Grand prize: $10,000')).toHaveLength(2)
    expect(sceneSources()).toEqual([])
    const practical = screen.getByRole('button', { name: /Most practical/ })
    const entertaining = screen.getByRole('button', {
      name: /Most entertaining/
    })
    expect(practical).toHaveAttribute('aria-expanded', 'true')
    entertaining.click()
    await nextTick()
    expect(practical).toHaveAttribute('aria-expanded', 'false')
    expect(entertaining).toHaveAttribute('aria-expanded', 'true')
  })
})
