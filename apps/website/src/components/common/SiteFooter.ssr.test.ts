// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import SiteFooter from './SiteFooter.vue'

vi.mock(import('@/composables/useReducedMotion'), () => ({
  prefersReducedMotion: () => true
}))

it('server-renders no logo frame and places the page fallback in the logo box', async () => {
  const html = await renderToString(
    createSSRApp({
      render: () =>
        h(SiteFooter, null, { 'logo-fallback': () => h('i', 'fallback') })
    })
  )

  expect(html).not.toContain('seq-footer_')
  expect(html).toMatch(/<i>fallback<\/i>(<!--[^>]*-->)*<canvas/)
})
