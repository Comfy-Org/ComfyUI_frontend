import { whenever } from '@vueuse/core'
import { computed, watch } from 'vue'

import {
  hostUser,
  isHostIdentityActive,
  requestHostSignIn
} from '@/platform/auth/host/hostIdentity'

import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useCommandStore } from '@/stores/commandStore'
import { useAuthStore } from '@/stores/authStore'
import type { AuthUserInfo } from '@/types/authTypes'

export const useCurrentUser = () => {
  const authStore = useAuthStore()
  const commandStore = useCommandStore()
  const apiKeyStore = useApiKeyAuthStore()

  const isHostIdentity = computed(() => isHostIdentityActive())
  const hostAccount = computed(() => hostUser())
  const isHostLogin = computed(() => hostAccount.value !== null)
  const firebaseUser = computed(() =>
    isHostIdentity.value ? null : authStore.currentUser
  )
  // A Firebase session takes precedence on every auth rail (see
  // authStore.getUserAuthHeader), so a stored key behind a Firebase login is
  // not an API-key session.
  const isApiKeyLogin = computed(
    () =>
      !isHostIdentity.value &&
      apiKeyStore.isAuthenticated &&
      firebaseUser.value === null
  )
  const isLoggedIn = computed(
    () =>
      isHostLogin.value || isApiKeyLogin.value || firebaseUser.value !== null
  )
  const isAuthInitialized = computed(() => authStore.isInitialized)

  const resolvedUserInfo = computed<AuthUserInfo | null>(() => {
    if (hostAccount.value) return { id: hostAccount.value.id }

    if (isApiKeyLogin.value && apiKeyStore.currentUser) {
      return { id: apiKeyStore.currentUser.id }
    }

    if (firebaseUser.value) {
      return { id: firebaseUser.value.uid }
    }

    return null
  })

  const onUserResolved = (callback: (user: AuthUserInfo) => void) =>
    whenever(resolvedUserInfo, callback, { immediate: true })

  const onTokenRefreshed = (callback: () => void) =>
    whenever(() => authStore.tokenRefreshTrigger, callback)

  const onUserLogout = (callback: () => void) => {
    watch(resolvedUserInfo, (user, prevUser) => {
      if (prevUser && !user) callback()
    })
  }

  const userDisplayName = computed(() => {
    if (isApiKeyLogin.value) {
      return apiKeyStore.currentUser?.name
    }
    return firebaseUser.value?.displayName
  })

  const userEmail = computed(() => {
    if (hostAccount.value) return hostAccount.value.email
    if (isApiKeyLogin.value) {
      return apiKeyStore.currentUser?.email
    }
    return firebaseUser.value?.email
  })

  const providerName = computed(() => {
    if (isHostLogin.value) return 'Comfy Desktop'
    if (isApiKeyLogin.value) {
      return 'Comfy API Key'
    }

    const providerId = firebaseUser.value?.providerData[0]?.providerId
    if (providerId?.includes('google')) {
      return 'Google'
    }
    if (providerId?.includes('github')) {
      return 'GitHub'
    }
    return providerId
  })

  const providerIcon = computed(() => {
    if (isApiKeyLogin.value) {
      return 'pi pi-key'
    }

    const providerId = firebaseUser.value?.providerData[0]?.providerId
    if (providerId?.includes('google')) {
      return 'pi pi-google'
    }
    if (providerId?.includes('github')) {
      return 'pi pi-github'
    }
    return 'pi pi-user'
  })

  const isEmailProvider = computed(() => {
    if (isApiKeyLogin.value) {
      return false
    }

    const providerId = firebaseUser.value?.providerData[0]?.providerId
    return providerId === 'password'
  })

  const userPhotoUrl = computed(() => {
    if (isApiKeyLogin.value) return null
    return firebaseUser.value?.photoURL
  })

  const handleSignOut = async () => {
    if (isApiKeyLogin.value) {
      await apiKeyStore.clearStoredApiKey()
    } else {
      await commandStore.execute('Comfy.User.SignOut')
    }
  }

  const handleSignIn = async () => {
    if (isHostIdentity.value) return requestHostSignIn()
    await commandStore.execute('Comfy.User.OpenSignInDialog')
  }

  return {
    loading: authStore.loading,
    isAuthInitialized,
    isLoggedIn,
    isApiKeyLogin,
    isHostLogin,
    isEmailProvider,
    userDisplayName,
    userEmail,
    userPhotoUrl,
    providerName,
    providerIcon,
    resolvedUserInfo,
    handleSignOut,
    handleSignIn,
    onUserResolved,
    onTokenRefreshed,
    onUserLogout
  }
}
