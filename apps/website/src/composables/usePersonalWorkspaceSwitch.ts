import { ref } from 'vue'

import { refreshWorkshopCredits } from '../config/workshop-credits'
import { useWorkshopSession } from '../config/workshop-session-state'

/**
 * Moves a workspace member whose team is out of credits onto their personal
 * workspace, then re-reads the balance that now pays for runs.
 */
export function usePersonalWorkspaceSwitch() {
  const { remint } = useWorkshopSession()
  const pending = ref(false)
  const failed = ref(false)

  async function switchToPersonal() {
    if (pending.value) return
    pending.value = true
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
      pending.value = false
    }
  }

  return { pending, failed, switchToPersonal }
}
