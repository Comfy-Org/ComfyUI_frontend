export type AutoTopUpCardAction = 'turn_on' | 'manage' | 'update_payment'

export type PlatformHandoffDestination =
  | { target: 'auto_top_up'; action: AutoTopUpCardAction }
  | { target: 'plans' | 'open_billing' | 'usage' }

/**
 * A click on a Settings billing link to the platform billing site.
 * `correlation_id` is the one the clicked link carries.
 */
export type PlatformHandoffBillingEvent = {
  operation: 'platform_handoff'
  stage: 'opened'
  outcome: 'pending'
  correlation_id: string
} & PlatformHandoffDestination
