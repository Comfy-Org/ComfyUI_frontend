import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import BillingBanner from './BillingBanner.vue'
import type { BillingBannerView } from './billingBannerView'
import { billingBannerCopy } from './__fixtures__/bannerCopy'

function renderBanner(
  view: BillingBannerView,
  props: { classes?: { root?: string }; addCreditsVariant?: 'inverted' } = {}
) {
  const onAction = vi.fn()
  const onDismiss = vi.fn()
  render(BillingBanner, {
    props: { view, copy: billingBannerCopy, onAction, onDismiss, ...props }
  })
  return { onAction, onDismiss }
}

function controls() {
  const status = screen.getByRole('status')
  return [
    ...within(status).queryAllByRole('button'),
    ...within(status).queryAllByRole('link')
  ].map((control) => `${control.tagName}:${control.textContent.trim()}`)
}

const text = { title: 'A title', body: 'A body' }

describe('BillingBanner', () => {
  it.for<{
    case: string
    view: BillingBannerView
    controls: string[]
    icon: string
    shell: string[]
  }>([
    {
      case: 'paused for an owner',
      view: { kind: 'paused', ...text, muted: false, action: 'updatePayment' },
      controls: ['BUTTON:Update payment'],
      icon: 'text-warning',
      shell: ['rounded-xl', 'p-3']
    },
    {
      case: 'paused for a member',
      view: { kind: 'paused', ...text, muted: true, action: null },
      controls: [],
      icon: 'text-muted-foreground',
      shell: ['rounded-xl', 'p-3']
    },
    {
      case: 'verify payment',
      view: {
        kind: 'planCheckout',
        ...text,
        muted: false,
        action: 'verifyPayment',
        href: 'https://pay.example/verify',
        dismissKey: null
      },
      controls: ['A:Complete verification'],
      icon: 'text-warning',
      shell: ['rounded-xl', 'p-3']
    },
    {
      case: 'payment received',
      view: {
        kind: 'planCheckout',
        ...text,
        muted: true,
        action: null,
        href: null,
        dismissKey: 'op-1:paymentReceived'
      },
      controls: ['BUTTON:Dismiss'],
      icon: 'text-muted-foreground',
      shell: ['rounded-xl', 'p-3']
    },
    {
      case: 'a failed top-up',
      view: {
        kind: 'topupCheckout',
        ...text,
        action: 'addCredits',
        dismissKey: 'cs_1:failed'
      },
      controls: ['BUTTON:Dismiss', 'BUTTON:Add credits'],
      icon: 'text-muted-foreground',
      shell: ['rounded-2xl', 'p-4']
    },
    {
      case: 'a parked payment',
      view: {
        kind: 'parked',
        ...text,
        action: 'contactSupport',
        href: 'https://comfy.org/contact/'
      },
      controls: ['A:Contact support'],
      icon: 'text-warning',
      shell: ['rounded-2xl', 'p-4']
    },
    {
      case: 'a plan status',
      view: { kind: 'planStatus', ...text },
      controls: [],
      icon: 'text-muted-foreground',
      shell: ['rounded-2xl', 'p-4']
    },
    {
      case: 'auto top-up failed',
      view: {
        kind: 'autoTopUp',
        ...text,
        action: 'updatePayment',
        href: 'https://platform.test/profile/billing'
      },
      controls: ['A:Update payment'],
      icon: 'text-warning',
      shell: ['rounded-xl', 'p-3']
    },
    {
      case: 'out of credits',
      view: {
        kind: 'credit',
        ...text,
        action: 'addCredits',
        dismissKey: 'outOfCredits'
      },
      controls: ['BUTTON:Dismiss', 'BUTTON:Add credits'],
      icon: 'text-warning',
      shell: ['rounded-xl', 'p-3']
    }
  ])('renders $case', ({ view, controls: expected, icon, shell }) => {
    renderBanner(view)

    const status = screen.getByRole('status')
    expect(status.textContent.replace(/\s+/g, '')).toContain('AtitleAbody')
    expect([...status.classList]).toEqual(expect.arrayContaining(shell))
    expect(screen.getByTestId('billing-banner-icon').classList).toContain(icon)
    expect(controls()).toEqual(expected)
  })

  it.for<{ view: BillingBannerView; role: 'button' | 'link'; name: string }>([
    {
      view: { kind: 'paused', ...text, muted: false, action: 'updatePayment' },
      role: 'button',
      name: 'Update payment'
    },
    {
      view: {
        kind: 'topupCheckout',
        ...text,
        action: 'addCredits',
        dismissKey: 'cs_1:failed'
      },
      role: 'button',
      name: 'Add credits'
    },
    {
      view: {
        kind: 'parked',
        ...text,
        action: 'contactSupport',
        href: 'https://comfy.org/contact/'
      },
      role: 'link',
      name: 'Contact support'
    }
  ])(
    'emits the $view.kind action instead of performing it',
    async ({ view, role, name }) => {
      const { onAction } = renderBanner(view)
      const control = screen.getByRole(role, { name })
      control.addEventListener('click', (event) => event.preventDefault())

      await userEvent.click(control)

      expect(onAction).toHaveBeenCalledWith(
        'action' in view ? view.action : null
      )
    }
  )

  it.for<{ view: BillingBannerView; row: string }>([
    {
      view: { kind: 'paused', ...text, muted: false, action: null },
      row: 'sm:flex-row'
    },
    {
      view: {
        kind: 'planCheckout',
        ...text,
        muted: true,
        action: null,
        href: null,
        dismissKey: null
      },
      row: 'sm:flex-row'
    },
    {
      view: {
        kind: 'parked',
        ...text,
        action: 'contactSupport',
        href: 'https://support.test'
      },
      row: 'sm:flex-row'
    },
    { view: { kind: 'planStatus', ...text }, row: '@2xl:flex-row' },
    {
      view: {
        kind: 'topupCheckout',
        ...text,
        action: null,
        dismissKey: 'cs_1:processing'
      },
      row: '@2xl:flex-row'
    }
  ])(
    'lays out $view.kind in a row from the app breakpoint',
    ({ view, row }) => {
      renderBanner(view)

      expect(screen.getByRole('status').className).toContain(row)
    }
  )

  it('links the action to the served url', () => {
    renderBanner({
      kind: 'autoTopUp',
      ...text,
      action: 'updatePayment',
      href: 'https://platform.test/profile/billing'
    })

    expect(
      screen.getByRole('link', { name: 'Update payment' }).getAttribute('href')
    ).toBe('https://platform.test/profile/billing')
  })

  it('emits the dismiss key', async () => {
    const { onDismiss } = renderBanner({
      kind: 'credit',
      ...text,
      action: null,
      dismissKey: 'lowCredits'
    })

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(onDismiss).toHaveBeenCalledWith('lowCredits')
  })

  it('lets the host replace the action and restyle the banner', () => {
    render(BillingBanner, {
      props: {
        view: {
          kind: 'credit',
          ...text,
          action: 'addCredits',
          dismissKey: 'outOfCredits'
        },
        copy: billingBannerCopy,
        classes: { root: 'host-root' }
      },
      slots: {
        action: `<template #action="{ label }"><a href="/credits">{{ label }}</a></template>`
      }
    })

    expect(
      screen.getByRole('link', { name: 'Add credits' }).getAttribute('href')
    ).toBe('/credits')
    expect(screen.getByTestId('billing-banner-credit').className).toContain(
      'host-root'
    )
  })
})
