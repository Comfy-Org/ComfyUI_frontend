/** Stable RUM action names for billing CTAs; frustration monitors match the `billing.` prefix. */
export const BILLING_ACTION_NAME = {
  addCreditsPopover: 'billing.add_credits.popover',
  addCreditsTile: 'billing.add_credits.credits_tile',
  addCreditsStatusBanner: 'billing.add_credits.status_banner',
  topUpPrimary: 'billing.top_up.primary',
  managePlanPopover: 'billing.manage_plan.popover',
  upgradePlanPanel: 'billing.upgrade_plan.panel',
  subscribeToRun: 'billing.subscribe.run_button',
  subscribeTopbar: 'billing.subscribe.topbar',
  subscribeTeamPlan: 'billing.plan_cta.team'
} as const

export function planCtaActionName(tierKey: string): string {
  return `billing.plan_cta.${tierKey}`
}
