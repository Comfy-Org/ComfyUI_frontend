import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Teleport, createSSRApp, h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'

import { htmlToTwin } from '../../lib/markdown-twin'
import WorkshopGate from './WorkshopGate.vue'

const { enabled, settled } = await vi.hoisted(async () => {
  const { ref } = await import('vue')
  return { enabled: ref(false), settled: ref(true) }
})
vi.mock(import('../../scripts/posthog'), () => ({
  useWorkshopEnabled: () => enabled,
  useWorkshopEnabledSettled: () => settled
}))

describe('WorkshopGate', () => {
  beforeEach(() => {
    enabled.value = false
    settled.value = true
  })

  it('keeps gated sections out of public HTML and Markdown exports', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(
            WorkshopGate,
            {},
            {
              default: () =>
                h('a', { href: '/models/private/' }, 'Private catalogue'),
              loading: () => h('h1', 'Loading'),
              fallback: () => h('h1', 'Public models')
            }
          )
      })
    )
    expect(html).not.toContain('Private catalogue')
    expect(html).not.toContain('/models/private/')
    const page = htmlToTwin(
      `<html><body><main>${html}</main></body></html>`,
      'https://comfy.org/'
    )
    expect(page.body).not.toContain('Private catalogue')
    expect(page.body).not.toContain('/models/private/')
  })

  it('shows the fallback once disabled and restores it on revocation', async () => {
    render(WorkshopGate, {
      slots: {
        default: '<h1>Instant render</h1>',
        loading: '<h1>Loading</h1>',
        fallback: '<h1>Public models</h1>'
      }
    })
    await nextTick()
    expect(screen.getByRole('heading').textContent).toBe('Public models')
    expect(screen.queryByText('Instant render')).toBeNull()
    enabled.value = true
    await nextTick()
    expect(screen.getByRole('heading').textContent).toBe('Instant render')
    enabled.value = false
    await nextTick()
    expect(screen.getByRole('heading').textContent).toBe('Public models')
    expect(screen.queryByRole('heading', { name: 'Instant render' })).toBeNull()
  })

  it('shows the loading slot, not the fallback, while the answer is pending', async () => {
    settled.value = false
    render(WorkshopGate, {
      slots: {
        default: '<h1>Instant render</h1>',
        loading: '<h1>Loading</h1>',
        fallback: '<h1>Public models</h1>'
      }
    })
    await nextTick()
    expect(screen.getByRole('heading').textContent).toBe('Loading')
    expect(screen.queryByText('Public models')).toBeNull()
    expect(screen.queryByText('Instant render')).toBeNull()

    enabled.value = true
    settled.value = true
    await nextTick()
    expect(screen.getByRole('heading').textContent).toBe('Instant render')
  })

  it('removes portalled catalogue controls when access is revoked', async () => {
    render(WorkshopGate, {
      slots: {
        default: () => h(Teleport, { to: 'body' }, h('h1', 'Model search'))
      }
    })
    enabled.value = true
    await nextTick()
    expect(screen.getByRole('heading', { name: 'Model search' })).toBeTruthy()
    enabled.value = false
    await nextTick()
    expect(screen.queryByRole('heading', { name: 'Model search' })).toBeNull()
  })
})
