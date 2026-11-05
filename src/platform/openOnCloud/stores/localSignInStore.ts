import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'

export const useLocalSignInStore = defineStore('openOnCloudLocalSignIn', () => {
  const { showSignInDialog } = useAuthDialogs()
  const { isLoggedIn } = useCurrentUser()
  const previewSignedIn = ref(false)
  const signedIn = computed(
    () => isLoggedIn.value || (import.meta.env.DEV && previewSignedIn.value)
  )

  async function signIn(preview: boolean) {
    if (import.meta.env.DEV && preview) {
      previewSignedIn.value = true
      return
    }
    await showSignInDialog()
  }

  return { signedIn, previewSignedIn, signIn }
})
