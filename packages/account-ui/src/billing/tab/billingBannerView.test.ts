import { describe, expect, it } from 'vitest'

import type {
  PlanCheckoutBanner,
  TopupCheckoutBanner
} from '@comfyorg/account-core/billing'

import {
  planCheckoutBannerView,
  selectBillingBanners,
  topupCheckoutBannerView
} from './billingBannerView'
import type { BillingBannerKind, BillingBannerView } from './billingBannerView'
import { billingBannerCopy } from './__fixtures__/bannerCopy'

const text = { title: 'Title', body: 'Body' }

const views: Record<BillingBannerKind, BillingBannerView> = {
  paused: { kind: 'paused', ...text, muted: false, action: 'updatePayment' },
  planCheckout: {
    kind: 'planCheckout',
    ...text,
    muted: true,
    action: null,
    href: null,
    dismissKey: 'op-1:paymentReceived'
  },
  topupCheckout: {
    kind: 'topupCheckout',
    ...text,
    action: null,
    dismissKey: 'cs_1:processing'
  },
  parked: {
    kind: 'parked',
    ...text,
    action: 'contactSupport',
    href: 'https://comfy.org/contact/'
  },
  planStatus: { kind: 'planStatus', ...text, action: null, href: null },
  autoTopUp: {
    kind: 'autoTopUp',
    ...text,
    action: 'updatePayment',
    href: 'https://platform.test/profile/billing'
  },
  credit: {
    kind: 'credit',
    ...text,
    action: 'addCredits',
    dismissKey: 'outOfCredits'
  }
}

describe('planCheckoutBannerView', () => {
  it.for<{ banner: PlanCheckoutBanner; expected: BillingBannerView }>([
    {
      banner: {
        kind: 'verifyPayment',
        opId: 'op-1',
        actionUrl: 'https://pay.example/verify'
      },
      expected: {
        kind: 'planCheckout',
        ...billingBannerCopy.planCheckout.verifyPayment,
        muted: false,
        action: 'verifyPayment',
        href: 'https://pay.example/verify',
        dismissKey: null
      }
    },
    {
      banner: { kind: 'verifyPayment', opId: 'op-1', actionUrl: null },
      expected: {
        kind: 'planCheckout',
        ...billingBannerCopy.planCheckout.verifyPayment,
        muted: false,
        action: null,
        href: null,
        dismissKey: null
      }
    },
    {
      banner: { kind: 'paymentReceived', opId: 'op-1' },
      expected: {
        kind: 'planCheckout',
        ...billingBannerCopy.planCheckout.paymentReceived,
        muted: true,
        action: null,
        href: null,
        dismissKey: 'op-1:paymentReceived'
      }
    }
  ])('maps $banner.kind', ({ banner, expected }) => {
    expect(planCheckoutBannerView(banner, billingBannerCopy)).toEqual(expected)
  })
})

describe('topupCheckoutBannerView', () => {
  it.for<{
    banner: TopupCheckoutBanner
    canTopUp: boolean
    expected: BillingBannerView
  }>([
    {
      banner: { kind: 'failed', sessionId: 'cs_1', paymentAmountCents: 2500 },
      canTopUp: true,
      expected: {
        kind: 'topupCheckout',
        title: "Your $25 top-up didn't go through",
        body: billingBannerCopy.topupCheckout.failedBody,
        action: 'addCredits',
        dismissKey: 'cs_1:failed'
      }
    },
    {
      banner: { kind: 'failed', sessionId: 'cs_1', paymentAmountCents: null },
      canTopUp: false,
      expected: {
        kind: 'topupCheckout',
        title: "Your top-up didn't go through",
        body: billingBannerCopy.topupCheckout.failedBody,
        action: null,
        dismissKey: 'cs_1:failed'
      }
    },
    {
      banner: { kind: 'creditsApplying', sessionId: 'cs_2' },
      canTopUp: true,
      expected: {
        kind: 'topupCheckout',
        ...billingBannerCopy.topupCheckout.creditsApplying,
        action: null,
        dismissKey: 'cs_2:creditsApplying'
      }
    },
    {
      banner: { kind: 'processing', sessionId: 'cs_3' },
      canTopUp: true,
      expected: {
        kind: 'topupCheckout',
        ...billingBannerCopy.topupCheckout.processing,
        action: null,
        dismissKey: 'cs_3:processing'
      }
    }
  ])(
    'maps $banner.kind with canTopUp $canTopUp',
    ({ banner, canTopUp, expected }) => {
      expect(
        topupCheckoutBannerView(banner, billingBannerCopy, canTopUp)
      ).toEqual(expected)
    }
  )
})

describe('selectBillingBanners', () => {
  it.for<{ case: string; shown: BillingBannerKind[]; stack: string[] }>([
    {
      case: 'every banner in tab order, credit hidden behind paused',
      shown: [
        'credit',
        'autoTopUp',
        'planStatus',
        'parked',
        'topupCheckout',
        'planCheckout',
        'paused'
      ],
      stack: ['paused', 'planCheckout', 'topupCheckout', 'parked', 'planStatus']
    },
    {
      case: 'credit alongside parked and plan status',
      shown: ['credit', 'parked', 'planStatus'],
      stack: ['parked', 'planStatus', 'credit']
    },
    {
      case: 'auto top-up hidden behind a plan checkout',
      shown: ['autoTopUp', 'planCheckout'],
      stack: ['planCheckout']
    },
    {
      case: 'credit hidden behind a top-up checkout',
      shown: ['credit', 'topupCheckout'],
      stack: ['topupCheckout']
    },
    {
      case: 'auto top-up on its own',
      shown: ['autoTopUp'],
      stack: ['autoTopUp']
    },
    { case: 'nothing', shown: [], stack: [] }
  ])('stacks $case', ({ shown, stack }) => {
    expect(
      selectBillingBanners(shown.map((kind) => views[kind])).map(
        ({ kind }) => kind
      )
    ).toEqual(stack)
  })
})
