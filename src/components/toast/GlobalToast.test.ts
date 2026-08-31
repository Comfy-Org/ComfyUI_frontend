import { createTestingPinia } from '@pinia/testing'
import { cleanup, render } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import GlobalToast from '@/components/toast/GlobalToast.vue'
import { GRAPH_CANVAS_ANCHOR } from '@/constants/splitterConstants'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

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
    // eslint-disable-next-line testing-library/no-node-access -- the auto-stub renders no role or testid, so no Testing Library query can select it
    const [main] = document.body.querySelectorAll('toast-stub')
    const classes = main.getAttribute('class') ?? ''

    // Both sides build from GRAPH_CANVAS_ANCHOR; each anchor() carries a
    // fallback so the toast still renders before the panel mounts.
    expect(main.getAttribute('position')).toBe('bottom-right')
    expect(classes).toContain(`anchor(${GRAPH_CANVAS_ANCHOR}_top,1rem)`)
    expect(classes).toContain(
      `anchor(${GRAPH_CANVAS_ANCHOR}_right,anchor(--docked-agent-panel_left,calc(100vw-var(--workspace-inset-right,0px)-0.75rem)))`
    )
  })

  it('keeps the billing-operation toast group on its own top-right outlet', () => {
    renderToast()
    // eslint-disable-next-line testing-library/no-node-access -- the auto-stub renders no role or testid, so no Testing Library query can select it
    const stubs = document.body.querySelectorAll('toast-stub')

    expect(stubs).toHaveLength(2)
    expect(stubs[1].getAttribute('group')).toBe('billing-operation')
    expect(stubs[1].getAttribute('position')).toBe('top-right')
    // The main outlet stays ungrouped so it never swallows billing messages.
    expect(stubs[0].getAttribute('group')).toBeNull()
  })
  it('holds messages raised during node selection mode until it exits', async () => {
    renderToast()
    const toastStore = useToastStore()
    const nodeSelectionStore = useAgentNodeSelectionStore()
    const message = { severity: 'error' as const, summary: 'Failed' }

    nodeSelectionStore.isActive = true
    await nextTick()

    toastStore.messagesToAdd = [message]
    await nextTick()

    // Held back rather than added to a hidden layer, where a message carrying
    // a `life` would expire unseen.
    expect(toastService.add).not.toHaveBeenCalled()
    expect(toastStore.messagesToAdd).toEqual([])

    nodeSelectionStore.isActive = false
    await nextTick()

    expect(toastService.add).toHaveBeenCalledWith(message)
  })

  it('replays held messages in the order they were raised', async () => {
    renderToast()
    const toastStore = useToastStore()
    const nodeSelectionStore = useAgentNodeSelectionStore()
    const first = { severity: 'error' as const, summary: 'First' }
    const second = { severity: 'error' as const, summary: 'Second' }

    nodeSelectionStore.isActive = true
    await nextTick()

    toastStore.messagesToAdd = [first]
    await nextTick()
    toastStore.messagesToAdd = [second]
    await nextTick()

    nodeSelectionStore.isActive = false
    await nextTick()

    expect(toastService.add.mock.calls).toEqual([[first], [second]])
  })

  it('does not replay anything when nothing was raised during the mode', async () => {
    renderToast()
    const nodeSelectionStore = useAgentNodeSelectionStore()

    nodeSelectionStore.isActive = true
    await nextTick()
    nodeSelectionStore.isActive = false
    await nextTick()

    expect(toastService.add).not.toHaveBeenCalled()
  })

  it('drops held messages when everything is dismissed mid-mode', async () => {
    renderToast()
    const toastStore = useToastStore()
    const nodeSelectionStore = useAgentNodeSelectionStore()

    nodeSelectionStore.isActive = true
    await nextTick()

    toastStore.messagesToAdd = [{ severity: 'error' as const, summary: 'Old' }]
    await nextTick()

    // A dismiss-everything clears the hidden queue too, or exiting would
    // resurrect exactly what the caller just cleared.
    toastStore.removeAllRequested = true
    await nextTick()

    nodeSelectionStore.isActive = false
    await nextTick()

    expect(toastService.add).not.toHaveBeenCalled()
  })
})
