import { defineStore } from 'pinia'
import { ref } from 'vue'

/** Set when an account's SSO org refused a non-SSO sign-in, for the auth pages. */
export const useSsoPromptStore = defineStore('ssoPrompt', () => {
  const prompt = ref<{ email: string } | null>(null)

  return {
    prompt,
    show: (email: string) => {
      prompt.value = { email }
    },
    dismiss: () => {
      prompt.value = null
    }
  }
})
