import { delay } from 'es-toolkit'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { reportError } from '@/platform/telemetry/reportError'
import {
  WorkspaceApiError,
  workspaceApi
} from '@/platform/workspace/api/workspaceApi'
import type { PlanCommandOutcome } from '@/platform/billing/components/billingTab/planLifecycle'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

function isCodedServerRefusal(err: unknown): err is WorkspaceApiError {
  return (
    err instanceof WorkspaceApiError &&
    err.code !== undefined &&
    err.status !== undefined &&
    err.status >= 400 &&
    err.status < 500
  )
}

const REVERT_POLL_INTERVAL_MS = 1500
const REVERT_POLL_ATTEMPTS = 20

type RevertSettlement = { settled: true } | { settled: false; cause: unknown }

async function readRevertOperation(
  opId: string
): Promise<RevertSettlement | null> {
  try {
    const operation = await workspaceApi.getBillingOpStatus(opId)
    if (operation.status === 'succeeded') return { settled: true }
    if (operation.status === 'pending') return null
    return {
      settled: false,
      cause:
        operation.error_message ??
        `Scheduled change revert ended as ${operation.status}`
    }
  } catch (cause) {
    return { settled: false, cause }
  }
}

async function waitForRevertOperation(opId: string): Promise<RevertSettlement> {
  for (let attempt = 0; attempt < REVERT_POLL_ATTEMPTS; attempt++) {
    await delay(REVERT_POLL_INTERVAL_MS)
    const settlement = await readRevertOperation(opId)
    if (settlement) return settlement
  }
  return { settled: false, cause: 'Scheduled change revert did not settle' }
}

async function requestRevert(): Promise<RevertSettlement> {
  const response = await workspaceApi.revertScheduledChange()
  return response.status === 'pending'
    ? waitForRevertOperation(response.billing_op_id)
    : { settled: true }
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
    const errorType = 'failure_reverting_scheduled_plan_change'
    try {
      const settlement = await requestRevert()
      if (!settlement.settled) {
        reportError(settlement.cause, { surface: 'billing', errorType })
        await resync()
        return { ok: false, serverMessage: null }
      }
    } catch (err) {
      return refusalOf(err, errorType)
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
