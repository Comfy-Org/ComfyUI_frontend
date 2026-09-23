// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import HeaderAccount from './HeaderAccount.vue'

vi.mock(import('../../scripts/posthog'))
vi.mock(import('../../config/workshop-session-state'))
vi.mock(import('../../config/workshop-credits'))

describe('HeaderAccount on the server', () => {
  it('renders the plain sign-in href, since hydration would never repair a mismatched one', async () => {
    expect(typeof window, 'this file must run without a window').toBe(
      'undefined'
    )

    const html = await renderToString(
      createSSRApp({ render: () => h(HeaderAccount) })
    )

    expect(html).toContain('href="/login/"')
    expect(html).not.toContain('returnTo')
  })
})
