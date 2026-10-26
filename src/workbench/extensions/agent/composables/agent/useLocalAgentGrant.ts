import { storeToRefs } from 'pinia'
import { toValue, watch } from 'vue'
import type { MaybeRefOrGetter, Ref } from 'vue'

import { useLocalAgentGrantReadStore } from './localAgentGrantReadStore'
import type { LocalAgentGrantArm } from './localAgentGrantReadStore'

export function useLocalAgentGrant(scope: MaybeRefOrGetter<string | null>) {
  const store = useLocalAgentGrantReadStore()
  watch(() => toValue(scope), store.setScope, {
    immediate: true,
    flush: 'sync'
  })
  const arm: Readonly<Ref<LocalAgentGrantArm>> = storeToRefs(store).arm
  return { arm, rereadIfFailed: store.rereadIfFailed }
}
