import type { AutoTopUpCardAction } from '@comfyorg/account-core/billing'

/** Platform Billing for an auto top-up action. Turn on lands with the setup dialog open. */
export function platformAutoTopUpPath(action: AutoTopUpCardAction) {
  return action === 'turn_on'
    ? '/profile/billing?auto_top_up=setup'
    : '/profile/billing'
}
