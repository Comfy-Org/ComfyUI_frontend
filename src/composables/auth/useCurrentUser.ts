import { whenever } from '@vueuse/core'
import { computed, watch } from 'vue'

import { useLocalOAuthStore } from '@/platform/auth/localOAuth/localOAuthStore'
import { isCloud } from '@/platform/distribution/types'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useCommandStore } from '@/stores/commandStore'
import { useAuthStore } from '@/stores/authStore'
import type { AuthUserInfo } from '@/types/authTypes'

export const useCurrentUser = () => {
  const authStore = useAuthStore()
  const commandStore = useCommandStore()
  const apiKeyStore = useApiKeyAuthStore()
  const localOAuthStore = useLocalOAuthStore()

  const firebaseUser = computed(() => authStore.currentUser)
  // Rail precedence (see authStore.getUserAuthHeader): Firebase, then the
  // local browser sign-in, then a stored API key.
  const isBrowserLogin = computed(
    () =>
      !isCloud && localOAuthStore.isAuthenticated && firebaseUser.value === null
  )
  const isApiKeyLogin = computed(
    () =>
      apiKeyStore.isAuthenticated &&
      firebaseUser.value === null &&
      !isBrowserLogin.value
  )
  const isLoggedIn = computed(
    () =>
      isBrowserLogin.value || isApiKeyLogin.value || firebaseUser.value !== null
  )
  const isAuthInitialized = computed(() => authStore.isInitialized)

  const resolvedUserInfo = computed<AuthUserInfo | null>(() => {
    if (isBrowserLogin.value && localOAuthStore.userId) {
      return { id: localOAuthStore.userId }
    }

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
    if (isBrowserLogin.value) return localOAuthStore.email
    if (isApiKeyLogin.value) {
      return apiKeyStore.currentUser?.name
    }
    return firebaseUser.value?.displayName
  })

  const userEmail = computed(() => {
    if (isBrowserLogin.value) return localOAuthStore.email
    if (isApiKeyLogin.value) {
      return apiKeyStore.currentUser?.email
    }
    return firebaseUser.value?.email
  })

  const providerName = computed(() => {
    if (isBrowserLogin.value) return 'Comfy account'
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
    if (isBrowserLogin.value) return 'pi pi-globe'
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
    if (isApiKeyLogin.value || isBrowserLogin.value) {
      return false
    }

    const providerId = firebaseUser.value?.providerData[0]?.providerId
    return providerId === 'password'
  })

  const userPhotoUrl = computed(() => {
    if (isApiKeyLogin.value || isBrowserLogin.value) return null
    return firebaseUser.value?.photoURL
  })

  const handleSignOut = async () => {
    if (isBrowserLogin.value) {
      localOAuthStore.signOut()
    } else if (isApiKeyLogin.value) {
      await apiKeyStore.clearStoredApiKey()
    } else {
      await commandStore.execute('Comfy.User.SignOut')
    }
  }

  const handleSignIn = async () => {
    await commandStore.execute('Comfy.User.OpenSignInDialog')
  }

  return {
    loading: authStore.loading,
    isAuthInitialized,
    isLoggedIn,
    isApiKeyLogin,
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
