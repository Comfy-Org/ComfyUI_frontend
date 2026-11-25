import type { PlatformHandoffDestination } from '@comfyorg/account-core/billing'
import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useTelemetry } from '@comfyorg/telemetry'
import type { PlatformHandoffView } from '@/platform/billing/localBillingHandoff'
import { openPlatformBillingHandoff } from '@/platform/billing/localBillingHandoff'
import { opensLocalBillingHandoff } from '@/platform/billing/localBillingWebEnabled'
import { createJourneyId } from '@/platform/billing/utils/checkoutJourney'
import { platformLink } from '@/platform/workspace/utils/platformLink'

/**
 * A platform link that carries one journey id and reports the click with it.
 * Unavailable where billing opens through a local handoff; only `usePlatformBillingLink` opens through one.
 */
export function usePlatformHandoff(
  path: MaybeRefOrGetter<`/${string}`>,
  destination: MaybeRefOrGetter<PlatformHandoffDestination>
) {
  const correlationId = ref(createJourneyId())
  const href = computed(() => platformLink(toValue(path), correlationId.value))
  const available = computed(() => !opensLocalBillingHandoff())

  function track() {
    useTelemetry()?.trackBillingEvent({
      operation: 'platform_handoff',
      stage: 'opened',
      outcome: 'pending',
      correlation_id: correlationId.value,
      ...toValue(destination)
    })
    setTimeout(() => {
      correlationId.value = createJourneyId()
    })
  }

  return { href, track, available }
}

/** Reports a Platform billing link's click and, where billing opens through a local handoff, opens Platform billing, or the page `view` names, through one. */
export function openPlatformBilling(
  track: () => void,
  view?: PlatformHandoffView
): void {
  track()
  if (opensLocalBillingHandoff()) void openPlatformBillingHandoff(view)
}

/**
 * A link to Platform's billing page, or the page `view` names: `button` is the
 * props for a design-system `Button`, and `open` runs on every click.
 */
export function usePlatformBillingLink(
  path: MaybeRefOrGetter<`/${string}`>,
  destination: MaybeRefOrGetter<PlatformHandoffDestination>,
  view?: PlatformHandoffView
) {
  const { href: platformHref, track } = usePlatformHandoff(path, destination)
  const href = computed(() =>
    opensLocalBillingHandoff() ? undefined : platformHref.value
  )
  const button = computed(() =>
    href.value
      ? { as: 'a', href: href.value, target: '_blank', rel: 'noopener' }
      : { as: 'button' }
  )
  return { href, button, open: () => openPlatformBilling(track, view) }
}

/** A link to Platform's Plans page, shaped as `usePlatformBillingLink`'s; through a local handoff it opens Plans signed in as the local account. */
export function usePlatformPlansLink() {
  return usePlatformBillingLink(
    '/profile/billing/plans',
    { target: 'plans' },
    'plans'
  )
}
