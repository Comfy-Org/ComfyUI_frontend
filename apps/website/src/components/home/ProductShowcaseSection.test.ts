// @vitest-environment happy-dom
/* eslint-disable testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { createSSRApp, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'

import { stubIntersectionObserver } from '../../test/fakeIntersectionObserver'
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

function renderComponent(props = {}) {
  const app = createSSRApp(ProductShowcaseSection, props)
  return renderToString(app)
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

  describe('aria-expanded', () => {
    it('sets aria-expanded="true" on the active accordion button', async () => {
      const html = await renderComponent()
      const buttons = html.match(/<button[^>]*>/g) ?? []

      expect(buttons.length).toBe(3)
      expect(buttons[0]).toContain('aria-expanded="true"')
    })

    it('sets aria-expanded="false" on inactive accordion buttons', async () => {
      const html = await renderComponent()
      const buttons = html.match(/<button[^>]*>/g) ?? []

      expect(buttons[1]).toContain('aria-expanded="false"')
      expect(buttons[2]).toContain('aria-expanded="false"')
    })
  })

  describe('aria-controls', () => {
    it('sets aria-controls linking each button to its panel', async () => {
      const html = await renderComponent()
      const buttons = html.match(/<button[^>]*>/g) ?? []

      expect(buttons[0]).toContain('aria-controls="feature-panel-0"')
      expect(buttons[1]).toContain('aria-controls="feature-panel-1"')
      expect(buttons[2]).toContain('aria-controls="feature-panel-2"')
    })

    it('renders matching panel ids for aria-controls references', async () => {
      const html = await renderComponent()

      expect(html).toContain('id="feature-panel-0"')
      expect(html).toContain('id="feature-panel-1"')
      expect(html).toContain('id="feature-panel-2"')
    })
  })

  describe('panel role', () => {
    it('marks each panel with role="region"', async () => {
      const html = await renderComponent()
      const panels = html.match(/id="feature-panel-\d+"[^>]*/g) ?? []

      expect(panels.length).toBe(3)
      for (const panel of panels) {
        expect(panel).toContain('role="region"')
      }
    })
  })
})
