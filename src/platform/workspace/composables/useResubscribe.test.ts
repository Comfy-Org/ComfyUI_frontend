import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent, ref } from 'vue'
import type { App } from 'vue'
import { createI18n } from 'vue-i18n'

import { useTelemetry } from '@/platform/telemetry'
import { useBillingRouting } from '@/composables/billing/useBillingRouting'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { AuthStoreError } from '@/stores/authStore'
import { mockBillingContext } from '@/utils/__tests__/mockBillingContext'

import { useResubscribe as createResubscribe } from './useResubscribe'

const state = vi.hoisted(() => ({
  shouldUseWorkspaceBilling: true,
  canManageSubscriptionLifecycle: true,
  canReactivatePlan: true,
  toastAdd: vi.fn()
}))

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/composables/billing/useBillingRouting'))

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

vi.mock(import('@/platform/telemetry'))

vi.mock<unknown>(
  import('primevue/usetoast'), // eslint-disable-line primevue-removal/no-imports
  () => ({
    useToast: () => ({ add: state.toastAdd })
  })
)

const apps: App<Element>[] = []

function useResubscribe(): ReturnType<typeof createResubscribe> {
  mockBillingContext()
  let result: ReturnType<typeof createResubscribe> | undefined
  const app = createApp(
    defineComponent({
      setup() {
        result = createResubscribe()
        return () => null
      }
    })
  )
  app.use(createI18n({ legacy: false, locale: 'en', messages: { en: {} } }))
  app.mount(document.createElement('div'))
  apps.push(app)
  if (!result) throw new Error('resubscribe composable not initialized')
  return result
}

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
})

describe('useResubscribe', () => {
  beforeEach(() => {
    Object.assign(useBillingRouting(), {
      shouldUseWorkspaceBilling: computed(() => state.shouldUseWorkspaceBilling)
    })
    Object.assign(useWorkspaceUI(), {
      permissions: computed(() => ({
        canManageSubscriptionLifecycle: state.canManageSubscriptionLifecycle
      })),
      canReactivatePlan: computed(() => state.canReactivatePlan)
    })
    state.shouldUseWorkspaceBilling = true
    state.canManageSubscriptionLifecycle = true
    useBillingCapabilities().canReactivate = computed(() => true)
    state.canReactivatePlan = true
  })

  it('does not resubscribe after the workspace role loses permission', async () => {
    const canReactivate = ref(true)
    useBillingCapabilities().canReactivate = computed(() => canReactivate.value)

    const { handleResubscribe, isResubscribing } = useResubscribe()
    state.canManageSubscriptionLifecycle = false
    canReactivate.value = false
    state.canReactivatePlan = false

    await handleResubscribe()

    expect(mockBillingContext().resubscribe).not.toHaveBeenCalled()
    expect(useTelemetry()?.trackResubscribeClicked).not.toHaveBeenCalled()
    expect(state.toastAdd).not.toHaveBeenCalled()
    expect(isResubscribing.value).toBe(false)
  })

  it('does not resubscribe when the server denies reactivation to a client-side owner', async () => {
    state.canManageSubscriptionLifecycle = true
    useBillingCapabilities().canReactivate = computed(() => false)
    state.canReactivatePlan = false
    const { handleResubscribe, isResubscribing } = useResubscribe()

    await handleResubscribe()

    expect(mockBillingContext().resubscribe).not.toHaveBeenCalled()
    expect(useTelemetry()?.trackResubscribeClicked).not.toHaveBeenCalled()
    expect(state.toastAdd).not.toHaveBeenCalled()
    expect(isResubscribing.value).toBe(false)
  })

  it('resubscribes when the policy permits it, whatever the raw capability says', async () => {
    // The legacy rail resolves can_reactivate false while the workspace may
    // still reactivate; this composable must follow the derived policy. Which
    // rail produces which value is covered in useWorkspaceUI.test.ts.
    useBillingCapabilities().canReactivate = computed(() => false)
    state.canReactivatePlan = true
    const { handleResubscribe } = useResubscribe()

    await handleResubscribe()

    expect(mockBillingContext().resubscribe).toHaveBeenCalled()
  })

  it('refuses whenever the policy denies it', async () => {
    // Behaviour change: the old gate short-circuited on the legacy rail and ran
    // no membership check, so a denial there never reached this branch.
    useBillingCapabilities().canReactivate = computed(() => false)
    state.canReactivatePlan = false
    const { handleResubscribe } = useResubscribe()

    await handleResubscribe()

    expect(mockBillingContext().resubscribe).not.toHaveBeenCalled()
  })

  it('fires a started event before resubscribe resolves', async () => {
    const { handleResubscribe } = useResubscribe()

    await handleResubscribe()

    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'resubscribe',
      stage: 'started',
      outcome: 'pending',
      source: 'settings_billing_panel'
    })
  })

  it('does not report checkout launch as terminal legacy success', async () => {
    state.shouldUseWorkspaceBilling = false
    state.canManageSubscriptionLifecycle = false
    // This case is about telemetry staging, not the gate; the workspace is
    // permitted to reactivate so the flow reaches the checkout launch.
    state.canReactivatePlan = true
    const { handleResubscribe } = useResubscribe()

    await handleResubscribe()

    expect(mockBillingContext().resubscribe).toHaveBeenCalledOnce()
    expect(useTelemetry()?.trackResubscribeClicked).toHaveBeenCalledOnce()
    expect(useTelemetry()?.trackBillingEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'succeeded' })
    )
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'resubscribe',
      stage: 'started',
      outcome: 'pending',
      source: 'settings_billing_panel'
    })
    // Exactly one started event on the legacy success rail: the pre-call start,
    // with no duplicate post-await started/pending emitted after resubscribe() resolves.
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledTimes(1)
    expect(state.toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success' })
    )
  })

  it('shows an error and resets loading when resubscription fails', async () => {
    vi.mocked(mockBillingContext().resubscribe).mockRejectedValueOnce(
      new Error('Resubscribe failed for person@example.com')
    )
    const { handleResubscribe, isResubscribing } = useResubscribe()

    await handleResubscribe()

    expect(mockBillingContext().resubscribe).toHaveBeenCalledOnce()
    expect(state.toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        detail: 'Resubscribe failed for person@example.com'
      })
    )
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'resubscribe',
      stage: 'failed',
      outcome: 'failure',
      source: 'settings_billing_panel',
      failure_category: 'unknown'
    })
    expect(isResubscribing.value).toBe(false)
  })

  it('fires resubscribe failure telemetry on the legacy rail too, categorizing the error', async () => {
    state.shouldUseWorkspaceBilling = false
    const authStoreError = new AuthStoreError(
      'checkout initiation rejected',
      500
    )
    vi.mocked(mockBillingContext().resubscribe).mockRejectedValueOnce(
      authStoreError
    )
    const { handleResubscribe } = useResubscribe()

    await handleResubscribe()

    expect(useTelemetry()?.trackBillingEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'succeeded' })
    )
    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'resubscribe',
      stage: 'failed',
      outcome: 'failure',
      source: 'settings_billing_panel',
      failure_category: 'api_rejected'
    })
  })

  it('categorizes an AuthStoreError with no status as a network failure, not an api rejection', async () => {
    state.shouldUseWorkspaceBilling = false
    const authStoreError = new AuthStoreError('offline')
    vi.mocked(mockBillingContext().resubscribe).mockRejectedValueOnce(
      authStoreError
    )
    const { handleResubscribe } = useResubscribe()

    await handleResubscribe()

    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith({
      operation: 'resubscribe',
      stage: 'failed',
      outcome: 'failure',
      source: 'settings_billing_panel',
      failure_category: 'network'
    })
  })

  it('emits started before the awaited resubscribe call resolves', async () => {
    const callOrder: string[] = []
    vi.mocked(mockBillingContext().resubscribe).mockImplementation(async () => {
      callOrder.push('resubscribe')
    })
    vi.mocked(useTelemetry()?.trackBillingEvent)?.mockImplementation(
      (event: { stage: string }) => {
        callOrder.push(`trackBillingEvent:${event.stage}`)
      }
    )
    const { handleResubscribe } = useResubscribe()

    await handleResubscribe()

    expect(callOrder.indexOf('trackBillingEvent:started')).toBeLessThan(
      callOrder.indexOf('resubscribe')
    )
  })
})
