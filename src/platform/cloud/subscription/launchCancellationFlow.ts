import { useBillingContext } from '@/composables/billing/useBillingContext'
import { t } from '@/i18n'
import { prepareChurnkey } from '@/platform/cloud/churnkey/churnkeyClient'
import { useTelemetry } from '@/platform/telemetry'
import type { SubscriptionCancellationMetadata } from '@/platform/telemetry/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { getErrorMessage } from '@/utils/errorUtil'

export interface CancellationFallbackOptions {
  flowAlreadyOpened?: boolean
}

interface LaunchCancellationFlowOptions {
  cancelAt?: string
  showFallback: (
    options?: CancellationFallbackOptions
  ) => void | Promise<unknown>
}

function cancellationMetadata(
  billing: ReturnType<typeof useBillingContext>,
  cancelAt?: string
): SubscriptionCancellationMetadata {
  const subscription = billing.subscription.value
  const endDate = cancelAt ?? subscription?.endDate
  return {
    source: 'cancel_plan_menu',
    current_tier: billing.tier.value?.toLowerCase(),
    ...(subscription?.duration
      ? {
          cycle:
            subscription.duration === 'ANNUAL'
              ? ('yearly' as const)
              : ('monthly' as const)
        }
      : {}),
    ...(endDate ? { end_date: endDate } : {})
  }
}

function customerAttributes(
  billing: ReturnType<typeof useBillingContext>
): Record<string, string> | undefined {
  const subscription = billing.subscription.value
  if (!subscription) return undefined

  const attributes = {
    ...(subscription.tier ? { tier: subscription.tier } : {}),
    ...(subscription.duration ? { cycle: subscription.duration } : {}),
    ...(subscription.planSlug ? { plan_slug: subscription.planSlug } : {})
  }
  return Object.keys(attributes).length > 0 ? attributes : undefined
}

let inFlight = false

export async function launchCancellationFlow({
  cancelAt,
  showFallback
}: LaunchCancellationFlowOptions): Promise<void> {
  if (inFlight) return
  inFlight = true
  try {
    await runCancellationFlow(cancelAt, showFallback)
  } finally {
    inFlight = false
  }
}

async function runCancellationFlow(
  cancelAt: string | undefined,
  showFallback: (
    options?: CancellationFallbackOptions
  ) => void | Promise<unknown>
): Promise<void> {
  const billing = useBillingContext()
  const workspaceStore = useTeamWorkspaceStore()
  const launchWorkspaceId = workspaceStore.activeWorkspaceId
  if (
    billing.type.value !== 'workspace' ||
    !launchWorkspaceId ||
    workspaceStore.activeWorkspaceBillingRail !== 'stripe'
  ) {
    await showFallback()
    return
  }

  const isLaunchWorkspaceCurrent = () =>
    workspaceStore.activeWorkspaceId === launchWorkspaceId

  const session = await prepareChurnkey().catch((error) => {
    console.warn('Failed to prepare ChurnKey cancellation flow:', error)
    return null
  })
  if (!session) {
    if (!isLaunchWorkspaceCurrent()) return
    await showFallback()
    return
  }
  if (!isLaunchWorkspaceCurrent()) return

  const telemetry = useTelemetry()
  const metadata = cancellationMetadata(billing, cancelAt)
  let didCancelSucceed = false
  let cancelError: unknown

  telemetry?.trackSubscriptionCancellation('flow_opened', metadata)

  try {
    const results = await session.show({
      customerAttributes: customerAttributes(billing),
      handleCancel: async () => {
        if (!isLaunchWorkspaceCurrent()) {
          throw new Error('Active workspace changed during cancellation')
        }
        telemetry?.trackSubscriptionCancellation('confirmed', metadata)
        try {
          await billing.cancelSubscription()
          didCancelSucceed = true
          await billing.fetchStatus().catch(() => undefined)
          return { message: t('subscription.cancelSuccess') }
        } catch (error) {
          cancelError = error
          throw new Error(
            getErrorMessage(error) ?? t('subscription.cancelDialog.failed'),
            { cause: error }
          )
        }
      }
    })

    if (cancelError) throw cancelError
    if (!didCancelSucceed && results.aborted === true) {
      telemetry?.trackSubscriptionCancellation('abandoned', metadata)
    }
  } catch (error) {
    if (didCancelSucceed || !isLaunchWorkspaceCurrent()) return
    telemetry?.trackSubscriptionCancellation('failed', {
      ...metadata,
      error_message:
        getErrorMessage(cancelError ?? error) ?? t('g.unknownError')
    })
    await showFallback({ flowAlreadyOpened: true })
  }
}
