import { whenever } from '@vueuse/core'
import { computed, watch } from 'vue'

import { desktopHostUser } from '@/platform/auth/desktopHost/desktopHostSession'
import { useApiKeyAuthStore } from '@/stores/apiKeyAuthStore'
import { useCommandStore } from '@/stores/commandStore'
import { useAuthStore } from '@/stores/authStore'
import type { AuthUserInfo } from '@/types/authTypes'

export const useCurrentUser = () => {
  const authStore = useAuthStore()
  const commandStore = useCommandStore()
  const apiKeyStore = useApiKeyAuthStore()

  const sessionUser = computed(() => authStore.sessionUser)
  const firebaseForSession = computed(() => {
    const user = authStore.currentUser
    return !sessionUser.value || user?.uid === sessionUser.value.id
      ? user
      : null
  })
  // A signed-in identity takes precedence on every auth rail (see
  // authStore.getUserAuthHeader), so a stored key behind one is not an
  // API-key session.
  const isApiKeyLogin = computed(
    () =>
      apiKeyStore.isAuthenticated &&
      authStore.currentUser === null &&
      !sessionUser.value &&
      !desktopHostUser.value
  )
  const isLoggedIn = computed(
    () => isApiKeyLogin.value || authStore.isAuthenticated
  )
  const isAuthInitialized = computed(() => authStore.isInitialized)

  const resolvedUserInfo = computed<AuthUserInfo | null>(() => {
    if (isApiKeyLogin.value && apiKeyStore.currentUser) {
      return { id: apiKeyStore.currentUser.id }
    }

    if (authStore.userId) return { id: authStore.userId }

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
    if (desktopHostUser.value) return undefined
    if (isApiKeyLogin.value) {
      return apiKeyStore.currentUser?.name
    }
    return sessionUser.value?.name ?? firebaseForSession.value?.displayName
  })

  const userEmail = computed(() => {
    if (isApiKeyLogin.value) {
      return apiKeyStore.currentUser?.email
    }
    return authStore.userEmail
  })

  const providerId = computed(
    () =>
      sessionUser.value?.signInProvider ??
      firebaseForSession.value?.providerData[0]?.providerId
  )

  const providerName = computed(() => {
    if (isApiKeyLogin.value) {
      return 'Comfy API Key'
    }
    if (providerId.value?.includes('google')) {
      return 'Google'
    }
    if (providerId.value?.includes('github')) {
      return 'GitHub'
    }
    return providerId.value
  })

  const providerIcon = computed(() => {
    if (isApiKeyLogin.value) {
      return 'pi pi-key'
    }
    if (providerId.value?.includes('google')) {
      return 'pi pi-google'
    }
    if (providerId.value?.includes('github')) {
      return 'pi pi-github'
    }
    return 'pi pi-user'
  })

  const isEmailProvider = computed(() => {
    if (isApiKeyLogin.value || authStore.signedInWithSso) {
      return false
    }
    const firebaseUser = firebaseForSession.value
    return firebaseUser
      ? firebaseUser.providerData[0]?.providerId === 'password'
      : sessionUser.value?.signInProvider === 'password'
  })

  const needsFirebaseSignIn = computed(
    () => !!sessionUser.value && !firebaseForSession.value
  )

  const userPhotoUrl = computed(() => {
    if (isApiKeyLogin.value) return null
    return firebaseForSession.value?.photoURL
  })

  const handleSignOut = async () => {
    if (isApiKeyLogin.value) {
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
    needsFirebaseSignIn,
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
