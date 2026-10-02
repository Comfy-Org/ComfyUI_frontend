export type BillingTierKey = 'free' | 'standard' | 'creator' | 'pro' | 'founder'

export type BillingCycle = 'monthly' | 'yearly'

export type SubscriptionCheckoutType = 'new' | 'change'

export type SubscriptionCheckoutTier = BillingTierKey | 'team'

export type ResubscribeSource = 'pricing_dialog' | 'settings_billing_panel'

/** Mirrors `BillingSource` in `@comfyorg/billing-contract`; a type test there fails when the two drift. */
export type PaymentIntentSource =
  | 'subscription_required'
  | 'out_of_credits'
  | 'top_up_blocked'
  | 'deep_link'
  | 'subscribe_to_run'
  | 'subscribe_now_button'
  | 'upgrade_to_add_credits'
  | 'settings_billing_panel'
  | 'avatar_menu_plans'
  | 'team_members_panel'
  | 'invite_member_upsell'
  | 'upload_model_upgrade'
  | 'team_upgrade_resume'
  | 'free_tier_quota'
  | 'agent_paywall'

/** Mirrors `BillingIntent` in `@comfyorg/billing-contract`; a type test there fails when the two drift. */
export type HostedBillingIntent =
  | 'pricing'
  | 'checkout'
  | 'top-up'
  | 'subscription'
  | 'payment-methods'
  | 'invoices'
  | 'result'
