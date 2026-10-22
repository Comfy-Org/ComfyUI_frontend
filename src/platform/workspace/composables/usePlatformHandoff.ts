import type { PlatformHandoffDestination } from '@comfyorg/account-core/billing'
import { computed, ref, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import { useTelemetry } from '@/platform/telemetry'
import { createJourneyId } from '@/platform/workspace/utils/checkoutJourney'
import { platformLink } from '@/platform/workspace/utils/platformLink'

/** A platform link that carries one journey id and reports the click with it. */
export function usePlatformHandoff(
  path: MaybeRefOrGetter<`/${string}`>,
  destination: MaybeRefOrGetter<PlatformHandoffDestination>
) {
  const correlationId = ref(createJourneyId())
  const href = computed(() => platformLink(toValue(path), correlationId.value))

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

  return { href, track }
}
