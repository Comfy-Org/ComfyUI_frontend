import { defineStore } from 'pinia'
import { computed, ref, watchEffect } from 'vue'

import type { User as UserConfig } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { CSSLoader } from '@/utils/cssLoader'

export interface User {
  userId: string
  username: string
}

export const useUserStore = defineStore('user', () => {
  /**
   * The user config. null if not loaded.
   */
  const userConfig = ref<UserConfig | null>(null)
  /**
   * The current user id. null if not logged in or in single user mode.
   */
  const currentUserId = ref<string | null>(null)
  const isMultiUserServer = computed(
    () => userConfig.value && 'users' in userConfig.value
  )
  const needsLogin = computed(
    () => !currentUserId.value && isMultiUserServer.value
  )
  const users = computed<User[]>(() =>
    Object.entries(userConfig.value?.users ?? {}).map(([userId, username]) => ({
      userId,
      username
    }))
  )
  const currentUser = computed<User | null>(
    () =>
      users.value.find((user) => user.userId === currentUserId.value) ?? null
  )
  const initialized = computed(() => userConfig.value !== null)

  /**
   * Loads user-specific CSS based on the current user context
   */
  async function loadUserCSS() {
    try {
      if (isMultiUserServer.value && currentUserId.value) {
        // Multi-user mode: load user-specific CSS
        await CSSLoader.loadUserCSS(currentUserId.value)
      } else {
        // Single-user mode: load default user.css
        await CSSLoader.loadUserCSS()
      }
    } catch (error) {
      // CSS loading failure should not break the app
      console.warn('Failed to load user CSS:', error)
    }
  }

  /**
   * Initialize the user store.
   */
  async function initialize() {
    userConfig.value = await api.getUserConfig()
    currentUserId.value = localStorage['Comfy.userId']

    // Load user-specific CSS after initialization
    await loadUserCSS()
  }

  /**
   * Create a new user.
   *
   * @param username - The username.
   * @returns The new user.
   */
  async function createUser(username: string): Promise<User> {
    const resp = await api.createUser(username)
    const data = await resp.json()
    if (resp.status >= 300) {
      throw new Error(
        data.error ??
          'Error creating user: ' + resp.status + ' ' + resp.statusText
      )
    }
    return {
      userId: data,
      username
    }
  }

  /**
   * Login the current user.
   *
   * @param user - The user.
   */
  async function login({
    userId,
    username
  }: {
    userId: string
    username: string
  }) {
    currentUserId.value = userId
    localStorage['Comfy.userId'] = userId
    localStorage['Comfy.userName'] = username

    // Load CSS for the newly logged in user
    await loadUserCSS()
  }

  watchEffect(() => {
    if (isMultiUserServer.value && currentUserId.value) {
      api.user = currentUserId.value
    }
  })

  /**
   * Logout the current user.
   */
  async function logout() {
    // Clean up user-specific CSS
    CSSLoader.removeUserCSS()

    delete localStorage['Comfy.userId']
    delete localStorage['Comfy.userName']

    // Reset current user
    currentUserId.value = null

    // Load default CSS if still in multi-user mode
    if (isMultiUserServer.value) {
      await loadUserCSS()
    }
  }

  return {
    users,
    currentUser,
    isMultiUserServer,
    needsLogin,
    initialized,
    initialize,
    createUser,
    login,
    logout,
    loadUserCSS
  }
})
