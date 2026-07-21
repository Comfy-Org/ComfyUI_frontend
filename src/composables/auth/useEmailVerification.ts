import { sendEmailVerification } from 'firebase/auth'
import { computed, ref } from 'vue'

import { useAuthStore } from '@/stores/authStore'

/**
 * Firebase email-verification state + actions for benefit-gated nudges
 * (EDU pricing today; free-tier eligibility later). Verification state is
 * read at load; after the inbox link is clicked, callers drive the flow off
 * refreshVerification()'s return value, not the computed.
 */
export function useEmailVerification() {
  const authStore = useAuthStore()
  const isSending = ref(false)
  const isSent = ref(false)

  const isEmailVerified = computed(
    () => authStore.currentUser?.emailVerified ?? null
  )

  const sendVerification = async () => {
    const user = authStore.currentUser
    if (!user || isSending.value) return
    isSending.value = true
    try {
      await sendEmailVerification(user)
      isSent.value = true
    } finally {
      isSending.value = false
    }
  }

  /** Reloads the user; true when now verified (also force-refreshes the token so API calls carry the claim). */
  const refreshVerification = async (): Promise<boolean> => {
    const user = authStore.currentUser
    if (!user) return false
    await user.reload()
    if (!user.emailVerified) return false
    await user.getIdToken(true)
    return true
  }

  return {
    isEmailVerified,
    isSending,
    isSent,
    sendVerification,
    refreshVerification
  }
}
