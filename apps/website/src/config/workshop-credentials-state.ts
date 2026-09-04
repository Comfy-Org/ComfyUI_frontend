import { computed, ref } from 'vue'

import {
  readStoredCredentials,
  writeStoredCredentials
} from './workshop-credentials'
import { useWorkshopSession } from './workshop-session-state'

/**
 * The credential shared between the key dialog, the run panel, and the
 * session. A live workspace session wins; the pasted key remains as the
 * developer fallback, untouched in localStorage, and is what a signed-out
 * visitor keeps using. Module-scoped rather than passed as props so islands
 * share one instance (see workshop-session-state).
 *
 * This ref is a DISPLAY of the credential, not its freshness guarantee: the
 * run path awaits the session's ensureFresh() before reading it (ADR 0011).
 */
const pastedKey = ref('')
let loaded = false

export function useWorkshopCredentials() {
  if (!loaded) {
    loaded = true
    pastedKey.value = readStoredCredentials()
  }
  const { session } = useWorkshopSession()
  return {
    credentials: computed(() => session.value?.token ?? pastedKey.value),
    save: (value: string) => {
      pastedKey.value = value
      writeStoredCredentials(value)
    }
  }
}
