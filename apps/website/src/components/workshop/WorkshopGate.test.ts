// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, nextTick, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

import { htmlToTwin } from '../../lib/markdown-twin'
import WorkshopGate from './WorkshopGate.vue'

const enabled = ref(false)
vi.mock(import('../../scripts/posthog'), () => ({
  useWorkshopEnabled: () => enabled
}))

describe('WorkshopGate', () => {
  it('keeps gated sections out of public Markdown exports', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(
            WorkshopGate,
            {},
            {
              default: () =>
                h('a', { href: '/models/private/' }, 'Private catalogue'),
              fallback: () => h('h1', 'Public models')
            }
          )
      })
    )
    const page = htmlToTwin(
      `<html><body><main>${html}</main></body></html>`,
      'https://comfy.org/'
    )
    expect(page.body).toContain('Public models')
    expect(page.body).not.toContain('Private catalogue')
    expect(page.body).not.toContain('/models/private/')
  })

  it('shows only the public fallback until enabled and restores it on revocation', async () => {
    render(WorkshopGate, {
      slots: {
        default: '<h1>Instant render</h1>',
        fallback: '<h1>Public models</h1>'
      }
    })
    expect(screen.getByRole('heading').textContent).toBe('Public models')
    enabled.value = true
    await nextTick()
    expect(screen.getByRole('heading').textContent).toBe('Instant render')
    enabled.value = false
    await nextTick()
    expect(screen.getByRole('heading').textContent).toBe('Public models')
  })
})
