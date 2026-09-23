import { defineStore } from 'pinia'
import { computed, ref, watchEffect } from 'vue'

import { isCloud } from '@/platform/distribution/types'
import type { UserConfigResponse } from '@/platform/remote/comfyui/types'
import { api } from '@/scripts/api'

export interface User {
  userId: string
  username: string
}

const USER_STYLESHEET_ID = 'user-stylesheet'
const USER_STYLESHEET_ROUTE = '/userdata/user.css'

export const useUserStore = defineStore('user', () => {
  /**
   * The user config. null if not loaded.
   */
  const userConfig = ref<UserConfigResponse | null>(null)
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

  let initializePromise: Promise<void> | null = null

  async function loadUserStylesheet() {
    if (isCloud) return

    if (!isMultiUserServer.value) {
      const link = document.createElement('link')
      link.id = USER_STYLESHEET_ID
      link.rel = 'stylesheet'
      link.href = api.apiURL(USER_STYLESHEET_ROUTE)
      document.head.prepend(link)
      return
    }

    try {
      const response = await api.fetchApi(USER_STYLESHEET_ROUTE)
      if (!response.ok) return

      const style =
        document.querySelector<HTMLStyleElement>(`#${USER_STYLESHEET_ID}`) ??
        document.createElement('style')
      style.id = USER_STYLESHEET_ID
      style.textContent = await response.text()
      if (!style.isConnected) document.head.prepend(style)
    } catch {
      return
    }
  }

  /**
   * Initialize the user store.
   */
  async function initialize() {
    initializePromise ??= (async () => {
      try {
        userConfig.value = await api.getUserConfig()
        currentUserId.value = localStorage['Comfy.userId']
        if (isMultiUserServer.value && currentUserId.value) {
          api.user = currentUserId.value
        }
        if (!needsLogin.value) await loadUserStylesheet()
      } catch (err) {
        initializePromise = null
        throw err
      }
    })()
    return initializePromise
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
    api.user = userId
    await loadUserStylesheet()
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
    delete localStorage['Comfy.userId']
    delete localStorage['Comfy.userName']
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
    logout
  }
})
