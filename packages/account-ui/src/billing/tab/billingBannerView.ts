import { topupCheckoutBannerKey } from '@comfyorg/account-core/billing'
import type {
  PlanCheckoutBanner,
  TopupCheckoutBanner
} from '@comfyorg/account-core/billing'

export type BillingBannerAction =
  | 'addCredits'
  | 'updatePayment'
  | 'verifyPayment'
  | 'contactSupport'

export interface BillingBannerText {
  readonly title: string
  readonly body: string
}

/** One Billing tab banner as the host resolved it: text, offered action, dismiss key. */
export type BillingBannerView = BillingBannerText &
  (
    | {
        readonly kind: 'paused'
        readonly muted: boolean
        readonly action: 'updatePayment' | null
      }
    | {
        readonly kind: 'planCheckout'
        readonly muted: boolean
        readonly action: 'verifyPayment' | null
        readonly href: string | null
        readonly dismissKey: string | null
      }
    | {
        readonly kind: 'topupCheckout'
        readonly action: 'addCredits' | null
        readonly dismissKey: string
      }
    | {
        readonly kind: 'parked'
        readonly action: 'contactSupport'
        readonly href: string
      }
    | { readonly kind: 'planStatus' }
    | {
        readonly kind: 'autoTopUp'
        readonly action: 'updatePayment'
        readonly href: string
      }
    | {
        readonly kind: 'credit'
        readonly action: 'addCredits' | 'updatePayment' | null
        readonly dismissKey: string
      }
  )

export type BillingBannerKind = BillingBannerView['kind']

/** Host-translated strings for the Billing tab banners. */
export interface BillingBannerCopy {
  readonly dismiss: string
  readonly actions: Readonly<Record<BillingBannerAction, string>>
  readonly planCheckout: Readonly<
    Record<PlanCheckoutBanner['kind'], BillingBannerText>
  >
  readonly topupCheckout: {
    readonly failedTitle: (paymentAmountCents: number | null) => string
    readonly failedBody: string
    readonly creditsApplying: BillingBannerText
    readonly processing: BillingBannerText
  }
}

interface BillingBannerLook {
  muted: boolean
  roomy: boolean
  windowBreakpoint: boolean
  action: BillingBannerAction | null
  href: string | null
  dismissKey: string | null
}

/** The banner view for a served plan checkout state. */
export function planCheckoutBannerView(
  banner: PlanCheckoutBanner,
  copy: BillingBannerCopy
): BillingBannerView {
  const text = copy.planCheckout[banner.kind]
  if (banner.kind === 'verifyPayment') {
    return {
      kind: 'planCheckout',
      ...text,
      muted: false,
      action: banner.actionUrl ? 'verifyPayment' : null,
      href: banner.actionUrl,
      dismissKey: null
    }
  }
  return {
    kind: 'planCheckout',
    ...text,
    muted: true,
    action: null,
    href: null,
    dismissKey: `${banner.opId}:${banner.kind}`
  }
}

/** The banner view for a served top-up checkout; Add credits only when the caller can top up. */
export function topupCheckoutBannerView(
  banner: TopupCheckoutBanner,
  copy: BillingBannerCopy,
  canTopUp: boolean
): BillingBannerView {
  const dismissKey = topupCheckoutBannerKey(banner)
  switch (banner.kind) {
    case 'failed':
      return {
        kind: 'topupCheckout',
        title: copy.topupCheckout.failedTitle(banner.paymentAmountCents),
        body: copy.topupCheckout.failedBody,
        action: canTopUp ? 'addCredits' : null,
        dismissKey
      }
    case 'creditsApplying':
    case 'processing':
      return {
        kind: 'topupCheckout',
        ...copy.topupCheckout[banner.kind],
        action: null,
        dismissKey
      }
  }
}

/** How a banner view renders: tone, shell size, action and dismissal. */
export function billingBannerLook(view: BillingBannerView): BillingBannerLook {
  switch (view.kind) {
    case 'paused':
      return { ...look(view.muted, false, view.action), windowBreakpoint: true }
    case 'planCheckout':
      return {
        ...look(view.muted, false, view.action, view.href, view.dismissKey),
        windowBreakpoint: true
      }
    case 'topupCheckout':
      return look(true, true, view.action, null, view.dismissKey)
    case 'parked':
      return {
        ...look(false, true, view.action, view.href),
        windowBreakpoint: true
      }
    case 'planStatus':
      return look(true, true, null)
    case 'autoTopUp':
      return look(false, false, view.action, view.href)
    case 'credit':
      return look(false, false, view.action, null, view.dismissKey)
  }
}

function look(
  muted: boolean,
  roomy: boolean,
  action: BillingBannerAction | null,
  href: string | null = null,
  dismissKey: string | null = null
): BillingBannerLook {
  return { muted, roomy, windowBreakpoint: false, action, href, dismissKey }
}

const STACK_ORDER: readonly BillingBannerKind[] = [
  'paused',
  'planCheckout',
  'topupCheckout',
  'parked',
  'planStatus',
  'autoTopUp',
  'credit'
]

const CREDIT_SUPPRESSORS: ReadonlySet<BillingBannerKind> = new Set([
  'paused',
  'planCheckout',
  'topupCheckout'
])

const CREDIT_KINDS: ReadonlySet<BillingBannerKind> = new Set([
  'autoTopUp',
  'credit'
])

/** The Billing tab banner stack: fixed order, credit banners hidden behind a paused or checkout banner. */
export function selectBillingBanners(
  views: readonly BillingBannerView[]
): BillingBannerView[] {
  const suppressCredit = views.some(({ kind }) => CREDIT_SUPPRESSORS.has(kind))
  return views
    .filter(({ kind }) => !(suppressCredit && CREDIT_KINDS.has(kind)))
    .toSorted(
      (a, b) => STACK_ORDER.indexOf(a.kind) - STACK_ORDER.indexOf(b.kind)
    )
}
