import { ref } from 'vue'

import { refreshWorkshopCredits } from '../config/workshop-credits'
import { useWorkshopSession } from '../config/workshop-session-state'

/**
 * Moving the run to the reader's own workspace, for when the one they are in
 * has no credits and adding them is somebody else's to do. The session is
 * minted again without a workspace, which is what the personal one is, and
 * the balance is re-read because the chip beside it is about to be wrong.
 */
export function usePersonalWorkspace() {
  const { remint } = useWorkshopSession()
  const switching = ref(false)
  const failed = ref(false)

  async function switchToPersonal() {
    if (switching.value) return
    switching.value = true
    failed.value = false
    try {
      const result = await remint(undefined, {
        preserveCredentialOnTransientFailure: true
      })
      if (result?.status === 'ok') await refreshWorkshopCredits({ force: true })
      else if (result?.status === 'error') failed.value = true
    } catch {
      failed.value = true
    } finally {
      switching.value = false
    }
  }

  return { switching, failed, switchToPersonal }
}
