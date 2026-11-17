import type { PlanRowCopy } from '#/billing/tab/planRowCopy'

export const planRowCopy: PlanRowCopy = {
  noPlanTitle: 'This workspace has no active plan',
  unknownTitle: 'Your plan',
  salesManagedTitle: 'Enterprise',
  activating: (plan) => `Activating your ${plan} plan…`,
  activeMonthly: (date) => `Billed monthly. Next invoice ${date}.`,
  activeYearly: (date) => `Billed yearly. Next invoice ${date}.`,
  scheduledChange: (plan, date) => `Changes to ${plan} on ${date}.`,
  paused: "Paused. The renewal payment didn't go through.",
  noPlanLine: 'Subscribe to run workflows on Cloud.',
  freeRunsLeft: (remaining, total) =>
    `You have ${remaining} of ${total} free runs left. Subscribe to keep running workflows after that.`,
  freeRunsUsed: (total) =>
    `You've used all ${total} free runs. Subscribe to keep running workflows.`,
  salesManagedLine: 'Billed by contract.',
  salesManagedRenews: (date) => `Billed by contract. Renews ${date}.`,
  ending: (date) => `Ends ${date}. You won't be charged again.`,
  ended: (date) => `Ended ${date}.`,
  endedNoDate: 'This plan has ended.',
  managedByOwner: 'Managed by the workspace owner.',
  actions: {
    manage: 'Manage',
    subscribe: 'Subscribe',
    choosePlan: 'Choose a plan',
    contactSales: 'Contact sales'
  }
}
