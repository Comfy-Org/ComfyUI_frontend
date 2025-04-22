import {
  type Auth,
  GithubAuthProvider,
  GoogleAuthProvider,
  type User,
  type UserCredential,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from 'firebase/auth'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useFirebaseAuth } from 'vuefire'

import { operations } from '@/types/comfyRegistryTypes'

type CreditPurchaseResponse =
  operations['InitiateCreditPurchase']['responses']['201']['content']['application/json']
type CreditPurchasePayload =
  operations['InitiateCreditPurchase']['requestBody']['content']['application/json']

// TODO: Switch to prod api based on environment (requires prod api to be ready)
const API_BASE_URL = 'https://stagingapi.comfy.org'

export const useFirebaseAuthStore = defineStore('firebaseAuth', () => {
  // State
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentUser = ref<User | null>(null)
  const isInitialized = ref(false)

  // Providers
  const googleProvider = new GoogleAuthProvider()
  const githubProvider = new GithubAuthProvider()

  // Getters
  const isAuthenticated = computed(() => !!currentUser.value)
  const userEmail = computed(() => currentUser.value?.email)
  const userId = computed(() => currentUser.value?.uid)

  // Get auth from VueFire and listen for auth state changes
  const auth = useFirebaseAuth()
  if (auth) {
    // Set persistence to localStorage (works in both browser and Electron)
    void setPersistence(auth, browserLocalPersistence)

    onAuthStateChanged(auth, (user) => {
      currentUser.value = user
      isInitialized.value = true
    })
  } else {
    error.value = 'Firebase Auth not available from VueFire'
  }

  const executeAuthAction = async <T>(
    action: (auth: Auth) => Promise<T>
  ): Promise<T> => {
    if (!auth) throw new Error('Firebase Auth not initialized')

    loading.value = true
    error.value = null

    try {
      return await action(auth)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Unknown error'
      throw e
    } finally {
      loading.value = false
    }
  }

  const login = async (
    email: string,
    password: string
  ): Promise<UserCredential> =>
    executeAuthAction((authInstance) =>
      signInWithEmailAndPassword(authInstance, email, password)
    )

  const register = async (
    email: string,
    password: string
  ): Promise<UserCredential> =>
    executeAuthAction((authInstance) =>
      createUserWithEmailAndPassword(authInstance, email, password)
    )

  const loginWithGoogle = async (): Promise<UserCredential> =>
    executeAuthAction((authInstance) =>
      signInWithPopup(authInstance, googleProvider)
    )

  const loginWithGithub = async (): Promise<UserCredential> =>
    executeAuthAction((authInstance) =>
      signInWithPopup(authInstance, githubProvider)
    )

  const logout = async (): Promise<void> =>
    executeAuthAction((authInstance) => signOut(authInstance))

  const getIdToken = async (): Promise<string | null> => {
    if (currentUser.value) {
      return currentUser.value.getIdToken()
    }
    return null
  }

  const addCredits = async (
    requestBodyContent: CreditPurchasePayload
  ): Promise<CreditPurchaseResponse | null> => {
    const token = await getIdToken()
    if (!token) {
      error.value = 'Cannot add credits: User not authenticated'
      return null
    }

    const response = await fetch(`${API_BASE_URL}/customers/credit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(requestBodyContent)
    })

    if (!response.ok) {
      const errorData = await response.json()
      error.value = `Failed to initiate credit purchase: ${errorData.message}`
      return null
    }

    // TODO: start polling /listBalance until balance is updated or n retries fail or report no change
    return response.json()
  }

  const initiateCreditPurchase = async (
    requestBodyContent: CreditPurchasePayload
  ): Promise<CreditPurchaseResponse | null> =>
    executeAuthAction((_) => addCredits(requestBodyContent))

  return {
    // State
    loading,
    error,
    currentUser,
    isInitialized,

    // Getters
    isAuthenticated,
    userEmail,
    userId,

    // Actions
    login,
    register,
    logout,
    getIdToken,
    loginWithGoogle,
    loginWithGithub,
    initiateCreditPurchase
  }
})
