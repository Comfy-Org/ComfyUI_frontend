import { render, screen } from '@testing-library/vue'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it, vi } from 'vitest'

import type {
  PlanRowAction,
  PlanRowState
} from '@comfyorg/account-core/billing'
import { BillingPlanRow as PackagePlanRow } from '@comfyorg/account-ui/billing'
import type { PlanRowCopy } from '@comfyorg/account-ui/billing'

import enMessages from '@/locales/en/main.json'

import AppPlanRow from './BillingPlanRow.vue'

vi.mock(import('@/platform/billing/composables/usePlatformHandoff'), () => ({
  usePlatformHandoff: () => ({
    href: computed(() => 'https://platform.test/profile/billing/plans'),
    track: vi.fn()
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})
const t = i18n.global.t
const k = 'workspacePanel.billingTab.plan'

const copy: PlanRowCopy = {
  noPlanTitle: t(`${k}.noPlan.title`),
  unknownTitle: t(`${k}.unknown.title`),
  salesManagedTitle: t(`${k}.salesManaged.title`),
  activating: (plan) => t(`${k}.activating`, { plan }),
  activeMonthly: (date) => t(`${k}.active.monthly`, { date }),
  activeYearly: (date) => t(`${k}.active.yearly`, { date }),
  scheduledChange: (plan, date) => t(`${k}.scheduledChange`, { plan, date }),
  paused: t(`${k}.paused`),
  noPlanLine: t(`${k}.noPlan.line`),
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
}

interface Rendered {
  title: string
  line: string | null
  action: string | null
}

function readRow(): Rendered {
  const controls = [
    ...screen.queryAllByRole('link'),
    ...screen.queryAllByRole('button')
  ]
  return {
    title: screen.getByRole('heading').textContent.trim(),
    line: screen.queryByTestId('billing-plan-line')?.textContent.trim() ?? null,
    action: controls.at(-1)?.textContent.trim() ?? null
  }
}

function renderBoth(
  state: PlanRowState,
  action: PlanRowAction | null,
  canManageSubscription: boolean
) {
  const app = render(AppPlanRow, {
    props: { state, action, canManageSubscription },
    global: {
      plugins: [i18n],
      stubs: { BillingPlanLifecycle: true }
    }
  })
  const appRow = readRow()
  app.unmount()
  const pkg = render(PackagePlanRow, {
    props: { state, action, canManageSubscription, copy, locale: 'en' }
  })
  const packageRow = readRow()
  pkg.unmount()
  return { appRow, packageRow }
}

const STATES: { case: string; state: PlanRowState }[] = [
  {
    case: 'active monthly',
    state: {
      kind: 'active',
      planName: 'Pro',
      cadence: 'monthly',
      nextInvoice: '2026-11-20T00:00:00Z',
      scheduledChange: null
    }
  },
  {
    case: 'active yearly with a scheduled change',
    state: {
      kind: 'active',
      planName: 'Pro',
      cadence: 'yearly',
      nextInvoice: '2027-01-10T00:00:00Z',
      scheduledChange: {
        planName: 'Creator',
        effectiveAt: '2027-01-10T00:00:00Z'
      }
    }
  },
  { case: 'activating', state: { kind: 'activating', planName: 'Pro' } },
  { case: 'paused', state: { kind: 'paused', planName: 'Pro' } },
  {
    case: 'ending',
    state: {
      kind: 'ending',
      planName: 'Pro',
      cadence: null,
      endsAt: '2026-11-20T00:00:00Z'
    }
  },
  {
    case: 'ended with a date',
    state: {
      kind: 'ended',
      planName: 'Pro',
      cadence: 'monthly',
      endedAt: '2026-10-01T00:00:00Z'
    }
  },
  {
    case: 'ended without a date or name',
    state: { kind: 'ended', planName: null, cadence: null, endedAt: null }
  },
  { case: 'no plan', state: { kind: 'noPlan', freeRuns: null } },
  {
    case: 'no plan with free runs left',
    state: { kind: 'noPlan', freeRuns: { remaining: 2, total: 5 } }
  },
  {
    case: 'no plan with free runs used',
    state: { kind: 'noPlan', freeRuns: { remaining: 0, total: 5 } }
  },
  {
    case: 'sales managed with a renewal',
    state: {
      kind: 'salesManaged',
      planName: 'Enterprise Plus',
      cadence: 'yearly',
      renewsAt: '2027-03-01T00:00:00Z'
    }
  },
  {
    case: 'sales managed without a renewal or name',
    state: {
      kind: 'salesManaged',
      planName: null,
      cadence: null,
      renewsAt: null
    }
  },
  { case: 'unknown', state: { kind: 'unknown' } }
]

const ACTIONS: (PlanRowAction | null)[] = [
  'manage',
  'subscribe',
  'choosePlan',
  'contactSales',
  null
]

describe('account-ui BillingPlanRow matches the app plan row', () => {
  describe.for([true, false])('canManageSubscription %s', (canManage) => {
    it.for(STATES)('renders $case the same', ({ state }) => {
      const { appRow, packageRow } = renderBoth(state, 'manage', canManage)

      expect(packageRow).toEqual(appRow)
    })
  })

  it.for(ACTIONS)('labels the %s action the same', (action) => {
    const { appRow, packageRow } = renderBoth({ kind: 'unknown' }, action, true)

    expect(packageRow.action).toBe(appRow.action)
  })
})
