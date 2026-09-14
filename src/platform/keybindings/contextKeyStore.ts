import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

export type ContextSnapshot = Readonly<Record<string, boolean>>

/** Derived by the dispatcher on every keydown rather than set by anyone. */
const BUILT_IN_CONTEXT_KEYS = ['modalOpen', 'textInputFocus']

const CONTEXT_KEY_PATTERN = /^[A-Za-z_][\w.-]*$/

export const CORE_CONTEXT_KEY_OWNER = 'core'

export const useContextKeyStore = defineStore('contextKey', () => {
  const values = shallowRef<Record<string, boolean>>(
    Object.fromEntries(BUILT_IN_CONTEXT_KEYS.map((key) => [key, false]))
  )
  const owners = new Map(
    BUILT_IN_CONTEXT_KEYS.map((key) => [key, CORE_CONTEXT_KEY_OWNER])
  )

  function register(name: string, owner: string): boolean {
    if (!CONTEXT_KEY_PATTERN.test(name)) {
      console.warn(`Context key "${name}" is not a valid identifier`)
      return false
    }
    const existingOwner = owners.get(name)
    if (existingOwner !== undefined && existingOwner !== owner) {
      console.warn(
        `Context key "${name}" is already registered by ${existingOwner}`
      )
      return false
    }
    owners.set(name, owner)
    if (!(name in values.value)) {
      values.value = { ...values.value, [name]: false }
    }
    return true
  }

  function set(name: string, value: boolean): boolean {
    if (!owners.has(name)) {
      console.warn(`Context key "${name}" is not registered`)
      return false
    }
    if (values.value[name] === value) return true
    values.value = { ...values.value, [name]: value }
    return true
  }

  function ownerOf(name: string): string | undefined {
    return owners.get(name)
  }

  function snapshot(): ContextSnapshot {
    return values.value
  }

  return { register, set, ownerOf, snapshot }
})
