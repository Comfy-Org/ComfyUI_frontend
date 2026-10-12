import type { CheckoutEntrySource } from '@comfyorg/account-core/billing'

import type { AddCreditsClickMetadata, PaymentIntentSource } from '../types'

type AddCreditsClickSource = AddCreditsClickMetadata['source']

const FROM_ADD_CREDITS_CLICK = {
  credits_panel: 'settings_billing_panel',
  avatar_menu: 'avatar_menu_plans',
  settings_billing_panel: 'settings_billing_panel',
  deep_link: 'deep_link',
  agent_paywall: 'agent_paywall'
} as const satisfies Record<AddCreditsClickSource, PaymentIntentSource>

const FROM_JOURNEY_ENTRY: ReadonlyMap<
  CheckoutEntrySource,
  PaymentIntentSource
> = new Map([
  ['deep_link', 'deep_link'],
  ['settings_billing', 'settings_billing_panel'],
  ['agent_paywall', 'agent_paywall']
])

/** The one source list's value for the control a customer clicked to add credits. */
export function paymentIntentSourceForAddCreditsClick(
  source: AddCreditsClickSource
): PaymentIntentSource {
  return FROM_ADD_CREDITS_CLICK[source]
}

/**
 * The one source list's value for a checkout journey's entry source, when the
 * entry source names one. `pricing`, `recovery`, `other` and `unknown` say
 * where the customer was, not which control they used.
 */
export function paymentIntentSourceForJourneyEntry(
  source: CheckoutEntrySource
): PaymentIntentSource | undefined {
  return FROM_JOURNEY_ENTRY.get(source)
}
