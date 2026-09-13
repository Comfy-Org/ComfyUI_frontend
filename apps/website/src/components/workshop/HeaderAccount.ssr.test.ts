// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'

import HeaderAccount from './HeaderAccount.vue'

vi.mock<unknown>(import('../../scripts/posthog'), async () => {
  const { ref } = await import('vue')
  return { useWorkshopAuthFlag: () => ref(true) }
})

vi.mock<unknown>(import('../../config/workshop-session-state'), async () => {
  const { ref } = await import('vue')
  return {
    useWorkshopSession: () => ({
      user: ref(null),
      session: ref(undefined),
      sessionFailure: ref(undefined),
      ensureFresh: vi.fn(),
      signOut: vi.fn()
    })
  }
})

vi.mock<unknown>(import('../../config/workshop-credits'), async () => {
  const { ref } = await import('vue')
  return { useWorkshopCredits: () => ({ balance: ref({ status: 'unknown' }) }) }
})

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
