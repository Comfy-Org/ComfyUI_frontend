import { ref } from 'vue'

import {
  readStoredCredentials,
  writeStoredCredentials
} from './workshop-credentials'

/**
 * The credential shared between the temporary key bar and the run panel.
 *
 * Module-scoped rather than passed as props because it is scaffolding: in the
 * real product the credential comes from a signed-in session and neither
 * component takes it as input at all. Keeping it out of the component
 * interfaces means deleting the bar is the whole removal.
 */
const credentials = ref('')
let loaded = false

export function useWorkshopCredentials() {
  if (!loaded) {
    loaded = true
    credentials.value = readStoredCredentials()
  }
  return {
    credentials,
    save: (value: string) => {
      credentials.value = value
      writeStoredCredentials(value)
    }
  }
}
