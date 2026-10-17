import { useBillingContext } from '@/composables/billing/useBillingContext'
import { reportError } from '@/platform/telemetry/reportError'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import type { PlanCommandOutcome } from '@/platform/workspace/components/dialogs/settings/billing/planLifecycle'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'

function isCodedServerRefusal(err: unknown): err is WorkspaceApiError {
  return (
    err instanceof WorkspaceApiError &&
    err.code !== undefined &&
    err.status !== undefined &&
    err.status >= 400 &&
    err.status < 500
  )
}

function refusalOf(err: unknown, errorType: string): PlanCommandOutcome {
  if (isCodedServerRefusal(err)) {
    return { ok: false, serverMessage: err.message }
  }
  reportError(err, { surface: 'billing', errorType })
  return { ok: false, serverMessage: null }
}

/** Revert a scheduled plan change or resume an ending plan, returning the server's refusal as data. */
export function usePlanLifecycleCommands() {
  const billing = useBillingContext()
  const capabilities = useBillingCapabilities()

  async function resync() {
    await Promise.allSettled([billing.fetchStatus(), capabilities.refresh()])
  }

  async function revertScheduledChange(): Promise<PlanCommandOutcome> {
    try {
      await workspaceApi.revertScheduledChange()
    } catch (err) {
      return refusalOf(err, 'failure_reverting_scheduled_plan_change')
    }
    await resync()
    return { ok: true }
  }

  async function resumePlan(): Promise<PlanCommandOutcome> {
    try {
      await billing.resubscribe({ source: 'settings_billing_panel' })
    } catch (err) {
      return refusalOf(err, 'failure_resuming_subscription')
    }
    await resync()
    return { ok: true }
  }

  return { revertScheduledChange, resumePlan }
}
