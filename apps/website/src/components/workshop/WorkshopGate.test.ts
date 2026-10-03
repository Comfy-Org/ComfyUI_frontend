import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref, Teleport, createSSRApp, h, nextTick } from 'vue'
import type { Ref } from 'vue'
import { renderToString } from 'vue/server-renderer'

import { htmlToTwin } from '../../lib/markdown-twin'
import {
  useWorkshopEnabled,
  useWorkshopEnabledSettled
} from '../../scripts/posthog'
import WorkshopGate from './WorkshopGate.vue'

vi.mock(import('../../scripts/posthog'))

let enabled: Ref<boolean>
let settled: Ref<boolean>

beforeEach(() => {
  enabled = ref(false)
  vi.mocked(useWorkshopEnabled).mockReturnValue(readonly(enabled))
  settled = ref(true)
  vi.mocked(useWorkshopEnabledSettled).mockReturnValue(readonly(settled))
})

describe('WorkshopGate', () => {
  it('restores a caller-owned recovery view while new admission is disabled', async () => {
    const view = render(WorkshopGate, {
      props: { allowRecovery: true },
      slots: {
        default: '<h1>Saved run</h1>',
        fallback: '<h1>Public models</h1>'
      }
    })
    expect(
      await screen.findByRole('heading', { name: 'Saved run' })
    ).toBeVisible()
    await view.rerender({ allowRecovery: false })
    expect(screen.getByRole('heading', { name: 'Public models' })).toBeVisible()
  })
  it('retains an existing recovery view after admission is disabled but never grants a new visit', async () => {
    const view = render(WorkshopGate, {
      props: { keepMounted: true, retainGranted: true },
      slots: { default: '<h1>My run</h1>', fallback: '<h1>Public models</h1>' }
    })
    await nextTick()
    expect(screen.getByRole('heading', { name: 'Public models' })).toBeVisible()
    enabled.value = true
    await nextTick()
    enabled.value = false
    await nextTick()
    expect(screen.getByRole('heading', { name: 'My run' })).toBeVisible()
    await view.rerender({ retainGranted: false })
    expect(screen.getByRole('heading', { name: 'Public models' })).toBeVisible()
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
