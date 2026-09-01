import { createTestingPinia } from '@pinia/testing'
import { cleanup, render, screen, waitFor, within } from '@testing-library/vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import GlobalToast from '@/components/toast/GlobalToast.vue'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useAgentNodeSelectionStore } from '@/stores/agentNodeSelectionStore'

function renderToast() {
  return render(GlobalToast, {
    global: {
      plugins: [
        createTestingPinia({ createSpy: vi.fn, stubActions: false }),
        PrimeVue,
        ToastService
      ]
    }
  })
}

describe('GlobalToast', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders queued messages and clears the queue', async () => {
    renderToast()
    const toastStore = useToastStore()
    const message = { severity: 'error' as const, summary: 'Failed' }

    toastStore.add(message)

    expect(await screen.findByText('Failed')).toBeVisible()
    expect(toastStore.messagesToAdd).toEqual([])
  })

  it('removes queued messages and clears the queue', async () => {
    renderToast()
    const toastStore = useToastStore()
    const message = { severity: 'info' as const, summary: 'Complete' }

    toastStore.add(message)
    expect(await screen.findByText('Complete')).toBeVisible()
    toastStore.remove(message)

    await waitFor(() => expect(screen.queryByText('Complete')).toBeNull())
    expect(toastStore.messagesToRemove).toEqual([])
  })

  it('removes all toast groups when requested', async () => {
    renderToast()
    const toastStore = useToastStore()

    toastStore.add({ severity: 'success', summary: 'Saved' })
    expect(await screen.findByText('Saved')).toBeVisible()
    toastStore.removeAll()

    await waitFor(() => expect(screen.queryByText('Saved')).toBeNull())
    expect(toastStore.removeAllRequested).toBe(false)
  })

  it('renders main messages in the graph outlet', async () => {
    renderToast()
    const toastStore = useToastStore()

    toastStore.add({ severity: 'info', summary: 'Graph updated' })

    const graphOutlet = await screen.findByTestId('graph-toast')
    expect(await within(graphOutlet).findByText('Graph updated')).toBeVisible()
    expect(
      within(screen.getByTestId('billing-operation-toast')).queryByText(
        'Graph updated'
      )
    ).toBeNull()
  })

  it('renders billing-operation messages in the dedicated outlet', async () => {
    renderToast()
    const toastStore = useToastStore()

    toastStore.add({
      group: 'billing-operation',
      severity: 'warn',
      summary: 'Confirm payment'
    })

    const billingOutlet = await screen.findByTestId('billing-operation-toast')
    expect(
      await within(billingOutlet).findByText('Confirm payment')
    ).toBeVisible()
    expect(
      within(screen.getByTestId('graph-toast')).queryByText('Confirm payment')
    ).toBeNull()
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

    expect(screen.queryByText('Failed')).toBeNull()
    expect(toastStore.messagesToAdd).toEqual([])

    nodeSelectionStore.isActive = false

    expect(await screen.findByText('Failed')).toBeVisible()
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

    const messages = await screen.findAllByRole('alert')
    expect(within(messages[0]).getByText('First')).toBeVisible()
    expect(within(messages[1]).getByText('Second')).toBeVisible()
  })

  it('does not replay anything when nothing was raised during the mode', async () => {
    renderToast()
    const nodeSelectionStore = useAgentNodeSelectionStore()

    nodeSelectionStore.isActive = true
    await nextTick()
    nodeSelectionStore.isActive = false
    await nextTick()

    expect(screen.queryByRole('alert')).toBeNull()
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

    expect(screen.queryByText('Old')).toBeNull()
  })
})
