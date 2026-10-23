import type { AutoReloadSettings } from '@/platform/workspace/api/workspaceApi'

export type AutoTopUpBannerKind = 'autoTopUpFailed' | 'autoTopUpOff'

export interface AutoTopUpBannerInput {
  enabled: boolean
  canManageAutoTopUp: boolean
  isPaused: boolean
  hasActivePlan: boolean
  status: AutoReloadSettings['status'] | null
  disabledReason: string | null
}

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
