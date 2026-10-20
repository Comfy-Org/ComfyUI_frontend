import type { AccountCredential } from '@comfyorg/account-core/session'

import { workshopIdempotencyKey } from '@/config/workshop-snippets'
import { captureWorkshopEvent } from '@/scripts/posthog'
import type { WorkshopRunAnalytics } from '@/scripts/workshop-analytics'

const OPENJUTSU_APP_SLUG = 'apps/openjutsu'

export type SwapOutcome =
  | { readonly status: 'succeeded'; readonly output_count: number }
  | { readonly status: 'cancelled' }
  | { readonly status: 'failed'; readonly reason: 'provider' | 'client' }

/**
 * Reports one run's start and end for the account that started it. With no
 * account (a local backend) nothing is reported.
 */
export function swapRunReport(
  startedFor: AccountCredential | undefined,
  now: () => number = Date.now
) {
  const startedAt = now()
  const analytics: WorkshopRunAnalytics | undefined = startedFor && {
    model_slug: OPENJUTSU_APP_SLUG,
    page_type: 'app',
    app_slug: OPENJUTSU_APP_SLUG,
    user_id: startedFor.uid,
    workspace_id: startedFor.workspace.id,
    attempt_id: workshopIdempotencyKey()
  }
  return {
    started() {
      if (analytics)
        captureWorkshopEvent({ name: 'run_started', properties: analytics })
    },
    finished(outcome: SwapOutcome) {
      if (analytics)
        captureWorkshopEvent({
          name: 'run_finished',
          properties: {
            ...analytics,
            duration_ms: now() - startedAt,
            ...outcome
          }
        })
    }
  }
}
