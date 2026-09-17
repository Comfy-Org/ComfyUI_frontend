import type { BillingStatusData } from '@comfyorg/account-core/billing'

import type {
  BillingStatusResponse,
  TeamCreditStopSummary
} from '@/platform/workspace/api/workspaceApi'

type DecodedCreditStop = NonNullable<BillingStatusData['team_credit_stop']>

/**
 * The generated zod schema coerces the credit stop's two int64 fields to
 * `bigint`, while the generated type the host reads them through says
 * `number`. Both are whole units bounded far inside the safe range — a
 * monthly credit count and a monthly USD commitment — so they are read back as
 * numbers, the way the core reads cents and the capability revision.
 */
function projectCreditStop(stop: DecodedCreditStop): TeamCreditStopSummary {
  return {
    id: stop.id,
    credits_monthly: Number(stop.credits_monthly),
    stop_usd: Number(stop.stop_usd)
  }
}

/** The SDK's decoded status in the shape the host's billing state holds. */
export function projectBillingStatus(
  status: BillingStatusData
): BillingStatusResponse {
  const { team_credit_stop, scheduled_change, ...rest } = status
  return {
    ...rest,
    team_credit_stop:
      team_credit_stop === null ? null : projectCreditStop(team_credit_stop),
    scheduled_change:
      scheduled_change === null
        ? null
        : {
            ...scheduled_change,
            team_credit_stop:
              scheduled_change.team_credit_stop === null
                ? null
                : projectCreditStop(scheduled_change.team_credit_stop)
          }
  }
}
