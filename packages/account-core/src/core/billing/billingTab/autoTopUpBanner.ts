import type { AutoReloadSettings } from '@comfyorg/ingest-types'

export type AutoTopUpBannerKind = 'autoTopUpFailed' | 'autoTopUpOff'

export interface AutoTopUpBannerInput {
  enabled: boolean
  canManageAutoTopUp: boolean
  isPaused: boolean
  hasActivePlan: boolean
  status: AutoReloadSettings['status'] | null
  disabledReason: string | null
}

/** The auto top-up banner for a served failed auto top-up, shown only to who can manage it on an active plan. */
export function deriveAutoTopUpBanner(
  input: AutoTopUpBannerInput
): AutoTopUpBannerKind | null {
  if (!input.enabled || !input.canManageAutoTopUp) return null
  if (input.isPaused || !input.hasActivePlan) return null
  if (input.status !== 'failed') return null
  return input.disabledReason === 'consecutive_declines'
    ? 'autoTopUpOff'
    : 'autoTopUpFailed'
}
