// @vitest-environment happy-dom
/* eslint-disable testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

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

function accordionTriggers(): HTMLElement[] {
  return screen
    .getAllByRole('button')
    .filter((button) => button.hasAttribute('aria-controls'))
}

function panelControlledBy(trigger: HTMLElement): HTMLElement | undefined {
  const panelsById = new Map(
    screen.getAllByRole('region').map((panel) => [panel.id, panel])
  )
  return panelsById.get(trigger.getAttribute('aria-controls') ?? '')
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

  describe('accordion semantics', () => {
    it('pairs every trigger with a region it does not contain', () => {
      renderSection()

      const triggers = accordionTriggers()
      expect(triggers).toHaveLength(3)

      for (const trigger of triggers) {
        const panel = panelControlledBy(trigger)

        expect(panel).toBeDefined()
        expect(trigger.contains(panel!)).toBe(false)
        expect(panel!.getAttribute('aria-labelledby')).toBe(trigger.id)
        expect(trigger.id).not.toBe('')
      }
    })

    it('expands only the selected feature', async () => {
      renderSection()

      const [first, second] = accordionTriggers()
      expect(first!.getAttribute('aria-expanded')).toBe('true')
      expect(second!.getAttribute('aria-expanded')).toBe('false')

      second!.click()
      await nextTick()

      expect(first!.getAttribute('aria-expanded')).toBe('false')
      expect(second!.getAttribute('aria-expanded')).toBe('true')
    })
  })
})
