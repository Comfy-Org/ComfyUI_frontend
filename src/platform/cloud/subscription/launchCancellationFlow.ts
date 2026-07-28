import { withTimeout } from 'es-toolkit/promise'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { t } from '@/i18n'
import {
  isChurnkeySessionTimeoutError,
  isUnsupportedChurnkeyOfferError,
  prepareChurnkey
} from '@/platform/cloud/churnkey/churnkeyClient'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTelemetry } from '@/platform/telemetry'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { getErrorMessage } from '@/utils/errorUtil'

import { createCancellationMetadata } from './cancellationTelemetry'

const PREPARATION_TIMEOUT_MS = 15_000
const CANCELLATION_TIMEOUT_MS = 3 * 60 * 1000

export interface CancellationFallbackOptions {
  flowAlreadyOpened?: boolean
}

interface LaunchCancellationFlowOptions {
  cancelAt?: string
  showFallback: (
    options?: CancellationFallbackOptions
  ) => void | Promise<unknown>
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
  } catch (error) {
    console.error('Failed to launch subscription cancellation flow:', error)
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
  const { permissions } = useWorkspaceUI()
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

  const session = await withTimeout(
    () => prepareChurnkey(),
    PREPARATION_TIMEOUT_MS
  ).catch((error) => {
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
  const subscription = billing.subscription.value
  const metadata = createCancellationMetadata({
    currentTier: billing.tier.value,
    duration: subscription?.duration,
    endDate: cancelAt ?? subscription?.endDate
  })
  let didCancelSucceed = false
  let cancelError: unknown

  telemetry?.trackSubscriptionCancellation('flow_opened', metadata)

  try {
    await session.show({
      customerAttributes: customerAttributes(billing),
      handleCancel: async () => {
        if (!isLaunchWorkspaceCurrent()) {
          throw new Error('Active workspace changed during cancellation')
        }
        if (!permissions.value.canManageSubscriptionLifecycle) {
          cancelError = new Error(t('subscription.cancelDialog.failed'))
          throw cancelError
        }
        telemetry?.trackSubscriptionCancellation('confirmed', metadata)
        try {
          await withTimeout(
            () => billing.cancelSubscription(),
            CANCELLATION_TIMEOUT_MS
          )
          didCancelSucceed = true
          void billing.fetchStatus().catch(() => undefined)
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
    if (!didCancelSucceed) {
      telemetry?.trackSubscriptionCancellation('abandoned', metadata)
    }
  } catch (error) {
    if (didCancelSucceed || !isLaunchWorkspaceCurrent()) return
    if (isChurnkeySessionTimeoutError(error)) {
      telemetry?.trackSubscriptionCancellation('abandoned', metadata)
      return
    }
    telemetry?.trackSubscriptionCancellation('failed', {
      ...metadata,
      error_message:
        getErrorMessage(cancelError ?? error) ?? t('g.unknownError')
    })
    if (cancelError || isUnsupportedChurnkeyOfferError(error)) {
      useToastStore().add({
        severity: 'error',
        summary: t('subscription.cancelDialog.failed'),
        detail: getErrorMessage(cancelError ?? error) ?? t('g.unknownError')
      })
      return
    }
    await showFallback({ flowAlreadyOpened: true })
  }
}
