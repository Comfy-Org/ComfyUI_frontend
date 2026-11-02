import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useDialogStore } from '@/stores/dialogStore'

const SIGN_IN_DIALOG_KEY = 'global-signin'

/**
 * A stand-in for local ComfyUI's sign-in. The real sign-in dialog signs in;
 * the prototype panel's toggle can also finish a sign-in it shows.
 */
export const useLocalSignInStore = defineStore('openOnCloudLocalSignIn', () => {
  const { showSignInDialog } = useAuthDialogs()
  const dialogStore = useDialogStore()
  const signedIn = ref(false)

  async function signIn() {
    if (await showSignInDialog()) signedIn.value = true
  }

  watch(signedIn, (isSignedIn) => {
    if (isSignedIn) dialogStore.closeDialog({ key: SIGN_IN_DIALOG_KEY })
  })

  return { signedIn, signIn }
})
