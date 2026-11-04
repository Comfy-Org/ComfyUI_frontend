import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'

import type {
  AddCreditsAvailability,
  CreditsCardState,
  PlanCreditsState
} from '@comfyorg/account-core/billing'
import { BillingCreditsCard as PackageCreditsCard } from '@comfyorg/account-ui/billing'
import type { CreditsCardCopy } from '@comfyorg/account-ui/billing'

import enMessages from '@/locales/en/main.json'

import AppCreditsCard from './BillingCreditsCard.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})
const t = i18n.global.t
const k = 'workspacePanel.billingTab.credits'

const copy: CreditsCardCopy = {
  title: t(`${k}.title`),
  rateInfo: t(`${k}.tooltipLabel`),
  rateTooltip: t(`${k}.tooltip`),
  available: t(`${k}.available`),
  unavailable: t(`${k}.unavailable`),
  tryAgain: t('workspacePanel.billingTab.tryAgain'),
  overdrawn: (count, credits) => t(`${k}.overdrawn`, { count }, credits),
  plan: t(`${k}.plan`),
  planTooltip: t(`${k}.planTooltip`),
  planOfPool: t(`${k}.planOfPool`, {
    remaining: '{remaining}',
    total: '{total}'
  }),
  planUsed: (percent) => t(`${k}.planUsed`, { percent }),
  refills: (date) => t('subscription.refillsDate', { date }),
  refillsAfterPayment: t('subscription.refillsAfterPayment'),
  availableUntil: (date) => t(`${k}.availableUntil`, { date }),
  topUp: t(`${k}.topUp`),
  topUpTooltip: t(`${k}.topUpTooltip`),
  inUse: t(`${k}.inUse`),
  addCredits: t(`${k}.addCredits`),
  addCreditsReason: (reasonKey) => t(reasonKey)
}

interface Control {
  name: string
  disabled: boolean
  className: string
  reason: string | null
}

interface Rendered {
  text: string
  controls: Control[]
  meter: string | null
  emitted: string[]
}

function controlOf(button: HTMLButtonElement): Control {
  const describedBy = button.getAttribute('aria-describedby')
  return {
    name: button.getAttribute('aria-label') ?? button.textContent.trim(),
    disabled: button.disabled,
    className: button.className,
    reason: describedBy
      ? (document.getElementById(describedBy)?.textContent.trim() ?? null)
      : null
  }
}

async function readCard(
  emitted: () => Record<string, unknown[]>
): Promise<Rendered> {
  const buttons = screen.queryAllByRole<HTMLButtonElement>('button')
  const rendered = {
    text: screen
      .getByTestId('billing-credits-card')
      .textContent.replace(/\s+/g, ' ')
      .trim(),
    controls: buttons.map(controlOf),
    meter: screen.queryByRole('meter')?.getAttribute('aria-valuenow') ?? null
  }
  for (const button of buttons.filter((b) => !b.getAttribute('aria-label'))) {
    await userEvent.click(button)
  }
  return { ...rendered, emitted: Object.keys(emitted()) }
}

async function renderBoth(
  state: CreditsCardState,
  addCredits: AddCreditsAvailability,
  planCreditNote: string | null,
  addCreditsVariant: 'secondary' | 'inverted'
) {
  const props = { state, addCredits, planCreditNote, addCreditsVariant }
  const app = render(AppCreditsCard, {
    props,
    global: { plugins: [i18n] }
  })
  const appCard = await readCard(app.emitted)
  app.unmount()
  const pkg = render(PackageCreditsCard, {
    props: { ...props, copy, locale: 'en' }
  })
  const packageCard = await readCard(pkg.emitted)
  pkg.unmount()
  return { appCard, packageCard }
}

const PLAN: PlanCreditsState = {
  kind: 'plan',
  availableCents: 700,
  planCents: 400,
  planPoolCredits: 1000,
  topUpCents: 300,
  topUpInUse: false,
  showUsage: true,
  planDate: { kind: 'refills', date: '2026-10-01T00:00:00Z' }
}

const STATES: { case: string; state: CreditsCardState }[] = [
  { case: 'unavailable', state: { kind: 'unavailable' } },
  { case: 'no plan', state: { kind: 'noPlan', availableCents: 200 } },
  {
    case: 'no plan overdrawn by one credit',
    state: { kind: 'noPlan', availableCents: -0.5 }
  },
  { case: 'plan with plan and top-up pools', state: PLAN },
  {
    case: 'top-up in use',
    state: {
      ...PLAN,
      availableCents: 1000,
      planCents: 0,
      topUpCents: 1000,
      topUpInUse: true
    }
  },
  {
    case: 'paused after payment',
    state: {
      ...PLAN,
      planCents: 0,
      showUsage: false,
      planDate: { kind: 'afterPayment' }
    }
  },
  {
    case: 'available until a date',
    state: {
      ...PLAN,
      planDate: { kind: 'availableUntil', date: '2026-12-31T12:00:00Z' }
    }
  },
  {
    case: 'refills without a date',
    state: { ...PLAN, planDate: { kind: 'refills', date: null } }
  },
  {
    case: 'plan without a known pool',
    state: { ...PLAN, planPoolCredits: null }
  },
  {
    case: 'overdrawn plan',
    state: { ...PLAN, availableCents: -100, planCents: 0, topUpCents: 0 }
  }
]

const AVAILABILITIES: { case: string; addCredits: AddCreditsAvailability }[] = [
  { case: 'enabled', addCredits: { kind: 'enabled' } },
  { case: 'hidden', addCredits: { kind: 'hidden' } },
  {
    case: 'disabled while paused',
    addCredits: {
      kind: 'disabled',
      reasonKey: 'credits.addCreditsRefusal.topupPurchasesPaused'
    }
  },
  {
    case: 'disabled while past due',
    addCredits: {
      kind: 'disabled',
      reasonKey: 'credits.addCreditsRefusal.paymentPastDue'
    }
  },
  {
    case: 'disabled for another reason',
    addCredits: {
      kind: 'disabled',
      reasonKey: 'credits.addCreditsRefusal.unavailable'
    }
  }
]

describe('account-ui BillingCreditsCard matches the app credits card', () => {
  describe.for(AVAILABILITIES)('Add credits $case', ({ addCredits }) => {
    it.for(STATES)('renders $case the same', async ({ state }) => {
      const { appCard, packageCard } = await renderBoth(
        state,
        addCredits,
        null,
        'secondary'
      )

      expect(packageCard).toEqual(appCard)
    })
  })

  it.for<'secondary' | 'inverted'>(['secondary', 'inverted'])(
    'renders the %s Add credits variant the same',
    async (variant) => {
      const { appCard, packageCard } = await renderBoth(
        PLAN,
        { kind: 'enabled' },
        null,
        variant
      )

      expect(packageCard).toEqual(appCard)
    }
  )

  it('renders the served plan credit note the same', async () => {
    const { appCard, packageCard } = await renderBoth(
      { kind: 'noPlan', availableCents: 200 },
      { kind: 'enabled' },
      'Subscribe to run workflows on Cloud.',
      'secondary'
    )

    expect(packageCard).toEqual(appCard)
  })
})
