import { renderToString } from 'vue/server-renderer'
import { createSSRApp } from 'vue'
import { describe, expect, it } from 'vitest'

import ProductShowcaseSection from './ProductShowcaseSection.vue'

function renderComponent(props = {}) {
  const app = createSSRApp(ProductShowcaseSection, props)
  return renderToString(app)
}

describe('ProductShowcaseSection', () => {
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
