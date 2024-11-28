import { api } from '@/scripts/api'
import { defineStore } from 'pinia'
import { computed, ref, watchEffect } from 'vue'
import type { User } from '@/types/apiTypes'

export const useUserStore = defineStore('user', () => {
  /**
   * The user config. null if not loaded.
   */
  const userConfig = ref<User | null>(null)
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

  /**
   * Initialize the user store.
   */
  async function initialize() {
    userConfig.value = await api.getUserConfig()
    currentUserId.value = localStorage['Comfy.userId']
  }

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
    isMultiUserServer,
    needsLogin,
    initialize,
    login,
    logout
  }
})
