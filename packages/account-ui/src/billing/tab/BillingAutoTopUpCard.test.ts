import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'

import type {
  AutoTopUpCardAction,
  AutoTopUpCardState,
  AutoTopUpOffView,
  AutoTopUpOffViewFacts
} from '@comfyorg/account-core/billing'

import BillingAutoTopUpCard from './BillingAutoTopUpCard.vue'
import { autoTopUpCardCopy } from './__fixtures__/autoTopUpCopy'
import { loaded, notConfiguredSettings } from './__fixtures__/autoTopUpSettings'

const RULE = 'Tops up to 6,275 credits when below 1,000 credits.'
const OPEN = 'icon-[lucide--arrow-up-right]'
const VARIANT_FILL = {
  inverted: 'bg-foreground',
  secondary: 'bg-secondary'
} as const
const OFF: AutoTopUpCardState = {
  kind: 'loaded',
  settings: notConfiguredSettings
}

function renderCard(
  state: AutoTopUpCardState,
  {
    offView = 'off',
    setup = null
  }: {
    offView?: AutoTopUpOffView
    setup?: AutoTopUpOffViewFacts['setup']
  } = {}
) {
  const onAction = vi.fn()
  const onRetry = vi.fn()
  render(TooltipProvider, {
    slots: {
      default: () =>
        h(BillingAutoTopUpCard, {
          state,
          offView,
          setup,
          copy: autoTopUpCardCopy,
          locale: 'en',
          onAction,
          onRetry
        })
    }
  })
  return { onAction, onRetry }
}

function lines() {
  return screen
    .getAllByTestId('billing-auto-top-up-line')
    .map((line) => line.textContent.trim())
}

describe('BillingAutoTopUpCard', () => {
  it.for<{
    case: string
    state: AutoTopUpCardState
    offView?: AutoTopUpOffView
    status: string
    lines: string[]
    label: string
    action: AutoTopUpCardAction
    variant: keyof typeof VARIANT_FILL
    icon: string
  }>([
    {
      case: 'on',
      state: loaded(),
      status: 'On',
      lines: [RULE, 'Monthly limit: $50 of $200 used'],
      label: 'Manage',
      action: 'manage',
      variant: 'secondary',
      icon: OPEN
    },
    {
      case: 'off',
      state: OFF,
      status: 'Off',
      lines: ['Refills credits when your balance runs low.'],
      label: 'Turn on',
      action: 'turn_on',
      variant: 'secondary',
      icon: OPEN
    },
    {
      case: 'on hold',
      state: loaded({ status: 'on_hold' }),
      status: 'On hold',
      lines: [
        RULE,
        'No default payment method. Set one to resume auto top-up.'
      ],
      label: 'Update payment',
      action: 'update_payment',
      variant: 'inverted',
      icon: OPEN
    },
    {
      case: 'paused by budget',
      state: loaded({ status: 'paused_by_budget' }),
      status: 'Limit reached',
      lines: [RULE, 'Monthly limit reached. Resumes November 28.'],
      label: 'Manage',
      action: 'manage',
      variant: 'secondary',
      icon: OPEN
    },
    {
      case: 'paused by the remainder without a reset date',
      state: loaded({
        status: 'paused_by_budget',
        paused_by_budget_remainder: true,
        cycle_resets_at: null
      }),
      status: 'Limit reached',
      lines: [RULE, 'Next top-up would go over your monthly limit.'],
      label: 'Manage',
      action: 'manage',
      variant: 'secondary',
      icon: OPEN
    },
    {
      case: 'failed',
      state: loaded({ status: 'failed' }),
      status: 'Failed',
      lines: [
        "Your charge didn't go through. Update your payment method or add credits manually."
      ],
      label: 'Update payment',
      action: 'update_payment',
      variant: 'inverted',
      icon: OPEN
    },
    {
      case: 'turned off after consecutive declines',
      state: loaded({
        status: 'failed',
        disabled_reason: 'consecutive_declines'
      }),
      status: 'Turned off',
      lines: [
        'Turned off after 3 declined charges. Update your payment method, then turn it back on.'
      ],
      label: 'Update payment',
      action: 'update_payment',
      variant: 'inverted',
      icon: OPEN
    },
    {
      case: 'maximum reached',
      state: loaded({
        status: 'paused_by_budget',
        monthly_budget_is_default: true
      }),
      status: 'Maximum reached',
      lines: [RULE, 'Monthly maximum reached. Resets November 28.'],
      label: 'Manage',
      action: 'manage',
      variant: 'secondary',
      icon: OPEN
    },
    {
      case: 'off without a payment method',
      state: OFF,
      offView: 'noPaymentMethod',
      status: 'Off',
      lines: ['Auto top-up needs a payment method. Add one to turn it on.'],
      label: 'Add payment method',
      action: 'update_payment',
      variant: 'secondary',
      icon: OPEN
    },
    {
      case: 'off without a default payment method',
      state: OFF,
      offView: 'noDefaultPaymentMethod',
      status: 'Off',
      lines: [
        'Auto top-up needs a default payment method. Set one to turn it on.'
      ],
      label: 'Update payment',
      action: 'update_payment',
      variant: 'secondary',
      icon: OPEN
    }
  ])(
    'renders $case and emits $action',
    async ({
      state,
      offView,
      status,
      label,
      action,
      variant,
      icon,
      ...expected
    }) => {
      const { onAction } = renderCard(state, { offView })

      expect(
        screen.getByTestId('billing-auto-top-up-status').textContent.trim()
      ).toBe(status)
      expect(lines()).toEqual(expected.lines)
      const button = screen.getByRole('button', { name: label })
      expect(button.className.split(' ')).toContain(VARIANT_FILL[variant])
      expect(button.innerHTML).toContain(icon)

      await userEvent.click(button)

      expect(onAction).toHaveBeenCalledExactlyOnceWith(action)
    }
  )

  it('explains the monthly limit in a tooltip', () => {
    renderCard(loaded())

    expect(
      screen.getByRole('button', {
        name: 'Counts only auto top-up charges. Resets November 28.'
      })
    ).toBeTruthy()
  })

  it('renders a placeholder and no action while loading', () => {
    renderCard({ kind: 'loading' })

    expect(screen.getByTestId('billing-auto-top-up-card')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByTestId('billing-auto-top-up-status')).toBeNull()
  })

  it('offers a retry when the settings are unavailable', async () => {
    const { onRetry } = renderCard({ kind: 'unavailable' })

    expect(screen.getByRole('alert').textContent).toContain(
      "Couldn't load auto top-up."
    )
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('renders nothing when the server marks setup unavailable', () => {
    renderCard(loaded(), {
      setup: { state: 'unavailable', reason: 'billing_rail_not_supported' }
    })

    expect(screen.queryByTestId('billing-auto-top-up-card')).toBeNull()
  })

  it('lets the host replace the actions, pick a variant and restyle the card', () => {
    render(BillingAutoTopUpCard, {
      props: {
        state: loaded({ status: 'failed' }),
        offView: 'off',
        setup: null,
        copy: autoTopUpCardCopy,
        locale: 'en',
        variants: { failed: 'destructive' },
        classes: { root: 'host-root' }
      },
      slots: {
        action: `<template #action="{ label, variant, action }"><a :href="'/billing#' + action" :data-variant="variant">{{ label }}</a></template>`
      }
    })

    const link = screen.getByRole('link', { name: 'Update payment' })
    expect(link.getAttribute('href')).toBe('/billing#update_payment')
    expect(link.dataset.variant).toBe('destructive')
    expect(screen.queryByRole('button', { name: 'Update payment' })).toBeNull()
    expect(screen.getByTestId('billing-auto-top-up-card').className).toContain(
      'host-root'
    )
  })

  it('keeps the status but no action when the host hides it', () => {
    render(BillingAutoTopUpCard, {
      props: {
        state: loaded({ status: 'failed' }),
        offView: 'off',
        setup: null,
        copy: autoTopUpCardCopy,
        locale: 'en',
        actionHref: 'https://billing.test/profile/billing',
        actionHidden: true
      }
    })

    expect(screen.getByTestId('billing-auto-top-up-status')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('opens the host link in a new tab and reports the action', async () => {
    const onAction = vi.fn()
    render(BillingAutoTopUpCard, {
      props: {
        state: loaded({ status: 'failed' }),
        offView: 'off',
        setup: null,
        copy: autoTopUpCardCopy,
        locale: 'en',
        actionHref: 'https://billing.test/profile/billing',
        onAction
      }
    })

    const link = screen.getByRole('link', { name: 'Update payment' })
    link.addEventListener('click', (event) => event.preventDefault())
    await userEvent.click(link)

    expect(link.getAttribute('href')).toBe(
      'https://billing.test/profile/billing'
    )
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.dataset.variant).toBe('inverted')
    expect(screen.queryByRole('button', { name: 'Update payment' })).toBeNull()
    expect(onAction).toHaveBeenCalledWith('update_payment')
  })

  it('lets the host replace the retry control', () => {
    render(BillingAutoTopUpCard, {
      props: {
        state: { kind: 'unavailable' },
        offView: 'off',
        setup: null,
        copy: autoTopUpCardCopy,
        locale: 'en'
      },
      slots: {
        retry: `<template #retry="{ label }"><a href="#retry">{{ label }}</a></template>`
      }
    })

    expect(screen.getByRole('link', { name: 'Try again' })).toBeTruthy()
  })
})
