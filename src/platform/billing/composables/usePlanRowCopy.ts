import type { PlanRowCopy } from '@comfyorg/account-ui/billing'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { isCloud } from '@/platform/distribution/types'

const k = 'workspacePanel.billingTab.plan'

/** The Billing tab plan row strings in the app locale. */
export function usePlanRowCopy() {
  const { t } = useI18n()
  return computed<PlanRowCopy>(() => ({
    noPlanTitle: t(`${k}.noPlan.title`),
    unknownTitle: t(`${k}.unknown.title`),
    salesManagedTitle: t(`${k}.salesManaged.title`),
    activating: (plan) => t(`${k}.activating`, { plan }),
    activeMonthly: (date) => t(`${k}.active.monthly`, { date }),
    activeYearly: (date) => t(`${k}.active.yearly`, { date }),
    scheduledChange: (plan, date) => t(`${k}.scheduledChange`, { plan, date }),
    paused: t(`${k}.paused`),
    noPlanLine: t(isCloud ? `${k}.noPlan.line` : `${k}.noPlan.localLine`),
    freeRunsLeft: (remaining, total) =>
      t(`${k}.noPlan.freeRunsLeft`, { remaining, total }),
    freeRunsUsed: (total) => t(`${k}.noPlan.freeRunsUsed`, { total }),
    salesManagedLine: t(`${k}.salesManaged.line`),
    salesManagedRenews: (date) => t(`${k}.salesManaged.renews`, { date }),
    ending: (date) => t(`${k}.ending`, { date }),
    ended: (date) => t(`${k}.ended`, { date }),
    endedNoDate: t(`${k}.endedNoDate`),
    managedByOwner: t(`${k}.managedByOwner`),
    actions: {
      manage: t(`${k}.actions.manage`),
      subscribe: t(`${k}.actions.subscribe`),
      choosePlan: t(`${k}.actions.choosePlan`),
      contactSales: t(`${k}.actions.contactSales`)
    }
  }))
}
