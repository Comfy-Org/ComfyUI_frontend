import type { BillingPolicyState } from './billingPolicyState'

export interface BillingPolicyCapabilities {
  topUpAccess: 'allowed' | 'subscription-required'
  /** Should render Cloud subscribe/upgrade upsell CTAs. */
  showsSubscribeUpsellUI: boolean
}

/**
 * Every `BillingPolicyState` case is mapped by hand: no
 * shared default, no derived/computed fields. Each row is independently
 * correct and auditable, and adding a new state is a compile
 * error here until it gets its own row.
 */
export function getBillingPolicyCapabilities(
  state: BillingPolicyState
): BillingPolicyCapabilities {
  switch (state.kind) {
    case 'LocalWithoutActiveSubscription':
      return { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    case 'LocalTeamWithoutActiveSubscription':
      return { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    case 'LocalEnterpriseWithoutActiveSubscription':
      return { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    case 'LocalAndUnknown':
      return { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    case 'LocalAndFree':
      return { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    case 'LocalAndStandard':
      return { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    case 'LocalAndCreator':
      return { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    case 'LocalAndPro':
      return { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    case 'LocalAndFounders':
      return { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    case 'LocalAndTeam':
      return { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    case 'CloudWithoutActiveSubscription':
      return {
        topUpAccess: 'subscription-required',
        showsSubscribeUpsellUI: true
      }
    case 'CloudTeamWithoutActiveSubscription':
      return {
        topUpAccess: 'subscription-required',
        showsSubscribeUpsellUI: false
      }
    // Sales-managed: reactivation goes through sales, so unlike the lapsed
    // self-serve Team state it neither withholds top-up nor upsells.
    case 'CloudEnterpriseWithoutActiveSubscription':
      return { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    case 'CloudAndUnknown':
      return { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    case 'CloudAndFree':
      return {
        topUpAccess: 'subscription-required',
        showsSubscribeUpsellUI: true
      }
    case 'CloudAndStandard':
      return { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    case 'CloudAndCreator':
      return { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    case 'CloudAndPro':
      return { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    case 'CloudAndFounders':
      return { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
    case 'CloudAndTeam':
      return { topUpAccess: 'allowed', showsSubscribeUpsellUI: false }
  }
}
