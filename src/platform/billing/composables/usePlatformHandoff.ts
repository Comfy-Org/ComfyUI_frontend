import type { PlatformHandoffDestination } from '@comfyorg/account-core/billing'
import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useTelemetry } from '@comfyorg/telemetry'
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

/** Reports a Platform billing link's click and, where billing opens through a local handoff, opens Platform billing through one. */
export function openPlatformBilling(track: () => void): void {
  track()
  if (opensLocalBillingHandoff()) void openPlatformBillingHandoff()
}

/**
 * A link to Platform's billing page. `href` is undefined where a click opens it
 * through a local handoff, so render a button; call `open` on every click.
 * `button` is those props for a design-system `Button`.
 */
export function usePlatformBillingLink(
  path: MaybeRefOrGetter<`/${string}`>,
  destination: MaybeRefOrGetter<PlatformHandoffDestination>
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
  return { href, button, open: () => openPlatformBilling(track) }
}
