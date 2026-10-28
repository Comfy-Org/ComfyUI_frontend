import type { HostedTopupCheckout } from '@comfyorg/ingest-types'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, nextTick, ref } from 'vue'
import type { Ref } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { reportError } from '@comfyorg/telemetry/reportError'
import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'
import { billingApi } from '@/platform/billing/api/billingApi'
import { useProcessingTopupPayment } from '@/platform/billing/composables/useProcessingTopupPayment'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@comfyorg/telemetry/reportError'))

function serveCheckout(checkoutState: HostedTopupCheckout['state']) {
  vi.spyOn(billingApi, 'listTopupCheckouts').mockResolvedValue({
    checkouts: [
      {
        amount_cents: 2500,
        created_at: '2026-10-20T00:00:00Z',
        session_id: 'cs_bank'
      }
    ],
    next_cursor: null
  })
  vi.spyOn(billingApi, 'getTopupCheckout').mockResolvedValue({
    amount_cents: 2500,
    payment_amount_cents: 2500,
    session_id: 'cs_bank',
    state: checkoutState
  })
}

function checkout(
  state: HostedTopupCheckout['state'],
  paymentAmountCents: number | null,
  sessionId: string
): HostedTopupCheckout {
  return {
    amount_cents: 2500,
    payment_amount_cents: paymentAmountCents,
    session_id: sessionId,
    state
  }
}

function listed(sessionId: string) {
  return {
    amount_cents: 2500,
    created_at: '2026-10-20T00:00:00Z',
    session_id: sessionId
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle
    reject = fail
  })
  return { promise, resolve, reject }
}

function renderPayment(shown: Ref<boolean>) {
  return render(
    defineComponent({
      setup() {
        const { payment } = useProcessingTopupPayment(shown)
        const label = computed(() => {
          if (!payment.value) return 'none'
          const cents = payment.value.paymentAmountCents
          return cents === null ? 'withheld' : String(cents)
        })
        return { label }
      },
      template: '<p role="status">{{ label }}</p>'
    })
  )
}

function enableProcessingRead() {
  vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = true
}

function leaveAndReturn() {
  window.dispatchEvent(new Event('blur'))
  window.dispatchEvent(new Event('focus'))
}

describe('useProcessingTopupPayment', () => {
  it('does not read checkouts while the surface is hidden', async () => {
    enableProcessingRead()
    const list = vi.spyOn(billingApi, 'listTopupCheckouts')
    const shown = ref(false)
    renderPayment(shown)

    await nextTick()
    expect(screen.getByRole('status')).toHaveTextContent('none')
    expect(list).not.toHaveBeenCalled()

    serveCheckout('payment_processing')
    shown.value = true
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2500')
    )

    shown.value = false
    await nextTick()
    expect(screen.getByRole('status')).toHaveTextContent('none')
  })

  it('keeps the newer amount when an older checkout read finishes later', async () => {
    enableProcessingRead()
    const shown = ref(true)
    const first = deferred<HostedTopupCheckout>()
    vi.spyOn(billingApi, 'listTopupCheckouts').mockResolvedValue({
      checkouts: [listed('cs_bank')],
      next_cursor: null
    })
    let reads = 0
    vi.spyOn(billingApi, 'getTopupCheckout').mockImplementation(() => {
      reads += 1
      return reads === 1
        ? first.promise
        : Promise.resolve(checkout('payment_processing', 100, 'cs_bank'))
    })
    renderPayment(shown)

    await waitFor(() =>
      expect(billingApi.getTopupCheckout).toHaveBeenCalledTimes(1)
    )
    shown.value = false
    await nextTick()
    shown.value = true

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('100')
    )
    first.resolve(checkout('payment_processing', 2500, 'cs_bank'))
    await first.promise
    await nextTick()
    expect(screen.getByRole('status')).toHaveTextContent('100')
  })

  it('withholds the amount when another checkout detail fails', async () => {
    enableProcessingRead()
    const cause = new WorkspaceApiError('unavailable', 503)
    vi.spyOn(billingApi, 'listTopupCheckouts').mockResolvedValue({
      checkouts: [listed('cs_bank'), listed('cs_other')],
      next_cursor: null
    })
    vi.spyOn(billingApi, 'getTopupCheckout').mockImplementation((sessionId) => {
      if (sessionId === 'cs_other') return Promise.reject(cause)
      return Promise.resolve(checkout('payment_processing', 2500, sessionId))
    })
    renderPayment(ref(true))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('withheld')
    )
    expect(reportError).toHaveBeenCalledWith(cause, {
      errorType: 'failure_reading_topup_checkout',
      surface: 'billing'
    })
  })

  it('reports a failed checkout detail without a processing notice', async () => {
    enableProcessingRead()
    const cause = new WorkspaceApiError('unavailable', 503)
    vi.spyOn(billingApi, 'listTopupCheckouts').mockResolvedValue({
      checkouts: [listed('cs_bank')],
      next_cursor: null
    })
    vi.spyOn(billingApi, 'getTopupCheckout').mockRejectedValue(cause)
    renderPayment(ref(true))

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(cause, {
        errorType: 'failure_reading_topup_checkout',
        surface: 'billing'
      })
    )
    await nextTick()
    expect(screen.getByRole('status')).toHaveTextContent('none')
  })

  it('drops the processing notice when focus returns to a failed checkout', async () => {
    enableProcessingRead()
    serveCheckout('payment_processing')
    renderPayment(ref(true))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2500')
    )
    const reads = vi.mocked(billingApi.getTopupCheckout).mock.calls.length
    vi.mocked(billingApi.getTopupCheckout).mockResolvedValue(
      checkout('failed', null, 'cs_bank')
    )
    leaveAndReturn()

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('none')
    )
    expect(billingApi.getTopupCheckout).toHaveBeenCalledTimes(reads + 1)
  })

  it('keeps the processing notice when a return read fails', async () => {
    enableProcessingRead()
    serveCheckout('payment_processing')
    renderPayment(ref(true))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2500')
    )
    const cause = new WorkspaceApiError('bad gateway', 502)
    vi.mocked(billingApi.listTopupCheckouts).mockRejectedValue(cause)
    leaveAndReturn()

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(cause, {
        errorType: 'failure_reading_topup_checkout',
        surface: 'billing'
      })
    )
    expect(screen.getByRole('status')).toHaveTextContent('2500')
  })

  it('keeps the processing notice without its amount when a return detail read fails', async () => {
    enableProcessingRead()
    serveCheckout('payment_processing')
    renderPayment(ref(true))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2500')
    )
    const cause = new WorkspaceApiError('bad gateway', 502)
    vi.mocked(billingApi.getTopupCheckout).mockRejectedValue(cause)
    leaveAndReturn()

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(cause, {
        errorType: 'failure_reading_topup_checkout',
        surface: 'billing'
      })
    )
    await nextTick()
    expect(screen.getByRole('status')).toHaveTextContent('withheld')
  })

  it('withholds the amount when a cached open sibling cannot be refreshed', async () => {
    enableProcessingRead()
    vi.spyOn(billingApi, 'listTopupCheckouts').mockResolvedValue({
      checkouts: [listed('cs_bank'), listed('cs_other')],
      next_cursor: null
    })
    vi.spyOn(billingApi, 'getTopupCheckout').mockImplementation((sessionId) =>
      Promise.resolve(
        sessionId === 'cs_other'
          ? checkout('open', null, sessionId)
          : checkout('payment_processing', 2500, sessionId)
      )
    )
    renderPayment(ref(true))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2500')
    )

    const cause = new WorkspaceApiError('bad gateway', 502)
    vi.mocked(billingApi.getTopupCheckout).mockImplementation((sessionId) =>
      sessionId === 'cs_other'
        ? Promise.reject(cause)
        : Promise.resolve(checkout('payment_processing', 2500, sessionId))
    )
    leaveAndReturn()

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('withheld')
    )
  })

  it('drops the notice when the processing checkout is fulfilled while another detail fails', async () => {
    enableProcessingRead()
    serveCheckout('payment_processing')
    renderPayment(ref(true))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2500')
    )

    const cause = new WorkspaceApiError('bad gateway', 502)
    vi.mocked(billingApi.listTopupCheckouts).mockResolvedValue({
      checkouts: [listed('cs_bank'), listed('cs_other')],
      next_cursor: null
    })
    vi.mocked(billingApi.getTopupCheckout).mockImplementation((sessionId) =>
      sessionId === 'cs_other'
        ? Promise.reject(cause)
        : Promise.resolve(checkout('fulfilled', 2500, sessionId))
    )
    leaveAndReturn()

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(cause, {
        errorType: 'failure_reading_topup_checkout',
        surface: 'billing'
      })
    )
    await nextTick()
    expect(screen.getByRole('status')).toHaveTextContent('none')
  })

  it('drops a checkout read that started in the previous workspace', async () => {
    enableProcessingRead()
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-a' })
    const workspaceARead = deferred<HostedTopupCheckout>()
    vi.spyOn(billingApi, 'listTopupCheckouts').mockResolvedValue({
      checkouts: [listed('cs_a')],
      next_cursor: null
    })
    vi.spyOn(billingApi, 'getTopupCheckout').mockReturnValue(
      workspaceARead.promise
    )
    renderPayment(ref(true))
    await waitFor(() =>
      expect(billingApi.getTopupCheckout).toHaveBeenCalledWith('cs_a')
    )

    const workspaceBList =
      deferred<Awaited<ReturnType<typeof billingApi.listTopupCheckouts>>>()
    vi.mocked(billingApi.listTopupCheckouts).mockReturnValueOnce(
      workspaceBList.promise
    )
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-b' })
    await waitFor(() =>
      expect(billingApi.listTopupCheckouts).toHaveBeenCalledTimes(2)
    )

    workspaceARead.resolve(checkout('payment_processing', 2500, 'cs_a'))
    await workspaceARead.promise
    await new Promise((settle) => setTimeout(settle))
    expect(screen.getByRole('status')).toHaveTextContent('none')

    vi.mocked(billingApi.getTopupCheckout).mockResolvedValue(
      checkout('payment_processing', 100, 'cs_b')
    )
    workspaceBList.resolve({ checkouts: [listed('cs_b')], next_cursor: null })
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('100')
    )
  })

  it('drops the notice without reporting when billing owner access is refused', async () => {
    enableProcessingRead()
    serveCheckout('payment_processing')
    renderPayment(ref(true))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2500')
    )

    vi.mocked(billingApi.listTopupCheckouts).mockRejectedValue(
      new WorkspaceApiError('Workspace billing owner required', 403)
    )
    leaveAndReturn()

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('none')
    )
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a failing checkout read once across returns', async () => {
    enableProcessingRead()
    const list = vi
      .spyOn(billingApi, 'listTopupCheckouts')
      .mockRejectedValue(new WorkspaceApiError('bad gateway', 502))
    renderPayment(ref(true))
    await waitFor(() => expect(reportError).toHaveBeenCalledTimes(1))

    leaveAndReturn()
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    await new Promise((settle) => setTimeout(settle))

    expect(reportError).toHaveBeenCalledTimes(1)
  })

  it('does not read again after the surface is gone', async () => {
    enableProcessingRead()
    serveCheckout('payment_processing')
    const view = renderPayment(ref(true))

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2500')
    )
    const lists = vi.mocked(billingApi.listTopupCheckouts).mock.calls.length
    view.unmount()
    leaveAndReturn()

    expect(billingApi.listTopupCheckouts).toHaveBeenCalledTimes(lists)
  })

  it('does not start a queued return read after the surface is gone', async () => {
    enableProcessingRead()
    serveCheckout('payment_processing')
    const view = renderPayment(ref(true))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('2500')
    )
    const pending = deferred<HostedTopupCheckout>()
    vi.mocked(billingApi.getTopupCheckout).mockReturnValue(pending.promise)
    leaveAndReturn()
    await waitFor(() =>
      expect(billingApi.getTopupCheckout).toHaveBeenCalledTimes(2)
    )
    leaveAndReturn()
    const lists = vi.mocked(billingApi.listTopupCheckouts).mock.calls.length

    view.unmount()
    pending.resolve(checkout('payment_processing', 2500, 'cs_bank'))
    await pending.promise
    await new Promise((settle) => setTimeout(settle))

    expect(billingApi.listTopupCheckouts).toHaveBeenCalledTimes(lists)
  })

  it('does not report a checkout read that fails after the surface is gone', async () => {
    enableProcessingRead()
    vi.spyOn(billingApi, 'listTopupCheckouts').mockResolvedValue({
      checkouts: [listed('cs_bank')],
      next_cursor: null
    })
    const pending = deferred<HostedTopupCheckout>()
    vi.spyOn(billingApi, 'getTopupCheckout').mockReturnValue(pending.promise)
    const view = renderPayment(ref(true))
    await waitFor(() =>
      expect(billingApi.getTopupCheckout).toHaveBeenCalledTimes(1)
    )

    view.unmount()
    pending.reject(new WorkspaceApiError('unavailable', 503))
    await pending.promise.catch(() => undefined)
    await new Promise((settle) => setTimeout(settle))

    expect(reportError).not.toHaveBeenCalled()
  })
})
