import type { UserState } from './userState'

export interface UserCapabilities {
  /** Can purchase additional (top-up) credits. */
  canTopUpCredits: boolean
  /** Should render Cloud subscribe/upgrade upsell CTAs. */
  showsSubscribeUpsellUI: boolean
}

/**
 * Every `UserState` case mapped to its capabilities by hand, on purpose: no
 * shared default, no derived/computed fields. Each row is independently
 * correct and auditable, and adding a new `UserState` case is a compile
 * error here until it gets its own row.
 */
export function getUserCapabilities(state: UserState): UserCapabilities {
  switch (state.kind) {
    case 'LocalWithoutActiveSubscription':
      return { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    case 'LocalTeamWithoutActiveSubscription':
      return { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    case 'LocalAndUnknown':
      return { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    case 'LocalAndFree':
      return { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    case 'LocalAndStandard':
      return { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    case 'LocalAndCreator':
      return { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    case 'LocalAndPro':
      return { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    case 'LocalAndFounders':
      return { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    case 'LocalAndTeam':
      return { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    case 'CloudWithoutActiveSubscription':
      return { canTopUpCredits: false, showsSubscribeUpsellUI: true }
    case 'CloudTeamWithoutActiveSubscription':
      return { canTopUpCredits: false, showsSubscribeUpsellUI: true }
    case 'CloudAndUnknown':
      return { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    case 'CloudAndFree':
      return { canTopUpCredits: false, showsSubscribeUpsellUI: true }
    case 'CloudAndStandard':
      return { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    case 'CloudAndCreator':
      return { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    case 'CloudAndPro':
      return { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    case 'CloudAndFounders':
      return { canTopUpCredits: true, showsSubscribeUpsellUI: false }
    case 'CloudAndTeam':
      return { canTopUpCredits: true, showsSubscribeUpsellUI: false }
  }
}
