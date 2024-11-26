import { api } from '@/scripts/api'
import { User } from '@/types/apiTypes'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const userConfig = ref<User | null>(null)
  const currentUserId = ref<string | null>(null)
  const isMultiUserServer = computed(
    () => userConfig.value && 'users' in userConfig.value
  )

  /**
   * Initialize the user store.
   */
  async function initialize() {
    userConfig.value = await api.getUserConfig()
    currentUserId.value = localStorage['Comfy.userId']
  }

  /**
   * Logout the current user.
   */
  async function logout() {
    delete localStorage['Comfy.userId']
    delete localStorage['Comfy.userName']
  }

  return {
    isMultiUserServer,
    initialize,
    logout
  }
})
