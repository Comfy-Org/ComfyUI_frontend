import { render, screen } from '@testing-library/vue'
import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { BillingAutoTopUpMemberBlock as PackageMemberBlock } from '@comfyorg/account-ui/billing'
import type {
  AutoTopUpMemberBlockCopy,
  AutoTopUpMemberView
} from '@comfyorg/account-ui/billing'

import enMessages from '@/locales/en/main.json'
import { autoTopUpMemberViewFact } from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

import AppMemberCard from './BillingAutoTopUpMemberCard.vue'

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})
const t = i18n.global.t
const k = 'workspacePanel.billingTab.autoTopUp'
const s = `${k}.memberStatus`

const copy: AutoTopUpMemberBlockCopy = {
  title: t(`${k}.title`),
  body: t(`${k}.member`),
  status: {
    failed: t(`${k}.status.failed`),
    turnedOff: t(`${k}.status.turnedOff`),
    off: t(`${k}.status.off`),
    on: t(`${k}.status.on`),
    onHold: t(`${k}.status.onHold`),
    limitReached: t(`${k}.status.limitReached`),
    maximumReached: t(`${k}.status.maximumReached`)
  },
  on: (target, threshold) => t(`${s}.on`, { target, threshold }),
  limitReached: (date) => t(`${s}.limitReached`, { date }),
  limitReachedNoDate: t(`${s}.limitReachedNoDate`),
  maximumReached: (date) => t(`${s}.maximumReached`, { date }),
  maximumReachedNoDate: t(`${s}.maximumReachedNoDate`),
  failed: t(`${s}.failed`),
  turnedOff: t(`${s}.turnedOff`),
  onHold: t(`${s}.onHold`)
}

const on: AutoTopUpMemberView = {
  status: 'on',
  threshold_credits: 1000,
  target_credits: 6275,
  cycle_resets_at: '2026-11-28T00:00:00Z',
  monthly_budget_is_default: false
}

function readBlock() {
  const block = screen.getByTestId('billing-auto-top-up-member-card')
  const status = screen.queryByTestId('billing-auto-top-up-status')
  return {
    heading: screen.getByRole('heading').textContent.trim(),
    text: block.textContent.trim(),
    className: block.className,
    status: status?.textContent.trim() ?? null,
    statusClassName: status?.className ?? null,
    dot: status?.querySelector('[aria-hidden="true"]')?.className ?? null,
    controls: screen.queryAllByRole('button').length
  }
}

describe('account-ui BillingAutoTopUpMemberBlock parity with the app member card', () => {
  it.for<{ case: string; view: AutoTopUpMemberView | null }>([
    { case: 'no served view', view: null },
    { case: 'on', view: on },
    { case: 'on without a target', view: { ...on, target_credits: null } },
    { case: 'off', view: { ...on, status: 'off' } },
    { case: 'limit reached', view: { ...on, status: 'paused_by_budget' } },
    {
      case: 'limit reached without a date',
      view: { ...on, status: 'paused_by_budget', cycle_resets_at: null }
    },
    {
      case: 'maximum reached',
      view: {
        ...on,
        status: 'paused_by_budget',
        monthly_budget_is_default: true
      }
    },
    { case: 'failed', view: { ...on, status: 'failed' } },
    {
      case: 'turned off',
      view: { ...on, status: 'failed', disabled_reason: 'consecutive_declines' }
    },
    { case: 'on hold', view: { ...on, status: 'on_hold' } },
    {
      case: 'a raw legacy view without a target',
      view: fromAny<AutoTopUpMemberView, unknown>({
        ...on,
        target_credits: undefined
      })
    },
    {
      case: 'a raw legacy view with fractional credits',
      view: fromAny<AutoTopUpMemberView, unknown>({
        ...on,
        threshold_credits: 999.5
      })
    }
  ])('renders the same status, line and no actions for $case', ({ view }) => {
    vi.mocked(useBillingCapabilities)().autoTopUpMemberView =
      autoTopUpMemberViewFact(view)
    const app = render(AppMemberCard, { global: { plugins: [i18n] } })
    const appBlock = readBlock()
    app.unmount()

    render(PackageMemberBlock, { props: { copy, view, locale: 'en' } })

    expect(readBlock()).toEqual(appBlock)
  })

  it.for([
    { case: 'without a target', patch: { target_credits: undefined } },
    { case: 'with fractional credits', patch: { threshold_credits: 999.5 } }
  ])(
    'falls back to the static notice for a raw legacy view $case',
    ({ patch }) => {
      vi.mocked(useBillingCapabilities)().autoTopUpMemberView =
        autoTopUpMemberViewFact(
          fromAny<AutoTopUpMemberView, unknown>({ ...on, ...patch })
        )
      render(AppMemberCard, { global: { plugins: [i18n] } })

      expect(readBlock()).toMatchObject({
        status: null,
        text: expect.stringContaining(
          'Credits can top up automatically when they run low.'
        )
      })
    }
  )
})
