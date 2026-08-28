import { createTestingPinia } from '@pinia/testing'
import { cleanup, render } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import GlobalToast from '@/components/toast/GlobalToast.vue'
import { useToastStore } from '@/platform/updates/common/toastStore'

const toastService = vi.hoisted(() => ({
  add: vi.fn(),
  remove: vi.fn(),
  removeAllGroups: vi.fn()
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => toastService
}))

function renderToast() {
  return render(GlobalToast, {
    global: {
      plugins: [createTestingPinia({ createSpy: vi.fn })],
      stubs: { Toast: true }
    }
  })
}

describe('GlobalToast', () => {
  afterEach(() => {
    cleanup()
  })

  it('forwards queued messages and clears the queue', async () => {
    renderToast()
    const toastStore = useToastStore()
    const message = { severity: 'error' as const, summary: 'Failed' }

    toastStore.messagesToAdd = [message]
    await nextTick()

    expect(toastService.add).toHaveBeenCalledWith(message)
    expect(toastStore.messagesToAdd).toEqual([])
  })

  it('forwards queued removals and clears the queue', async () => {
    renderToast()
    const toastStore = useToastStore()
    const message = { severity: 'info' as const, summary: 'Complete' }

    toastStore.messagesToRemove = [message]
    await nextTick()

    expect(toastService.remove).toHaveBeenCalledWith(message)
    expect(toastStore.messagesToRemove).toEqual([])
  })

  it('removes all toast groups when requested', async () => {
    renderToast()
    const toastStore = useToastStore()

    toastStore.removeAllRequested = true
    await nextTick()

    expect(toastService.removeAllGroups).toHaveBeenCalledOnce()
    expect(toastStore.removeAllRequested).toBe(false)
  })

  it('anchors the main toast to the canvas panel with viewport fallbacks', () => {
    renderToast()
    // Toast is stubbed, so the outlets carry no roles or text; the stub
    // elements' attributes are the only assertion surface.
    // eslint-disable-next-line testing-library/no-node-access -- stub-attribute pin; no Testing Library query can reach a stub
    const [main] = document.body.querySelectorAll('toast-stub')
    const classes = main.getAttribute('class') ?? ''

    // The anchor names must match the [anchor-name:--graph-canvas-panel]
    // declaration on the canvas SplitterPanel (see
    // LiteGraphCanvasSplitterOverlay.test); each carries a fallback so the
    // toast still renders when no anchor target is mounted yet.
    expect(main.getAttribute('position')).toBe('bottom-right')
    expect(classes).toContain('anchor(--graph-canvas-panel_top,1rem)')
    expect(classes).toContain(
      'anchor(--graph-canvas-panel_right,anchor(--docked-agent-panel_left,calc(100vw-0.75rem)))'
    )
  })

  it('keeps the billing-operation toast group on its own top-right outlet', () => {
    renderToast()
    // eslint-disable-next-line testing-library/no-node-access -- stub-attribute pin; no Testing Library query can reach a stub
    const stubs = document.body.querySelectorAll('toast-stub')

    expect(stubs).toHaveLength(2)
    expect(stubs[1].getAttribute('group')).toBe('billing-operation')
    expect(stubs[1].getAttribute('position')).toBe('top-right')
    // The main outlet stays ungrouped so it never swallows billing messages.
    expect(stubs[0].getAttribute('group')).toBeNull()
  })
})
