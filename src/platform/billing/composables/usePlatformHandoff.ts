import type { PlatformHandoffDestination } from '@comfyorg/account-core/billing'
import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useTelemetry } from '@comfyorg/telemetry'
import { opensLocalBillingHandoff } from '@/platform/billing/localBillingWebEnabled'
import { createJourneyId } from '@/platform/billing/utils/checkoutJourney'
import { platformLink } from '@/platform/workspace/utils/platformLink'

/**
 * A platform link that carries one journey id and reports the click with it.
 * Unavailable where billing opens through a local handoff, until Platform receives one.
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
