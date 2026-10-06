// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import SiteFooter from './SiteFooter.vue'

vi.mock(import('@/composables/useReducedMotion'), () => ({
  prefersReducedMotion: () => true
}))

it('server-renders the logo image only for visitors without JavaScript', async () => {
  const html = await renderToString(
    createSSRApp({ render: () => h(SiteFooter) })
  )

  expect(html.match(/seq-footer_/g)).toHaveLength(1)
  expect(html).toMatch(
    /<noscript><img[^>]*seq-footer_00074\.webp[^>]*><\/noscript>/
  )
})
