import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import { reportError } from '@/platform/telemetry/reportError'

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
  const providers = shallowRef(new Map<string, ReadonlySet<() => boolean>>())
  const failedProviders = new WeakSet<() => boolean>()

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

  function snapshot(requestedKeys?: ReadonlySet<string>): ContextSnapshot {
    const context = { ...values.value }
    for (const [name, getters] of providers.value) {
      if (requestedKeys && !requestedKeys.has(name)) continue
      const results = [...getters].map((get) => {
        try {
          return get()
        } catch (error) {
          if (!failedProviders.has(get)) {
            failedProviders.add(get)
            reportError(error, {
              errorType: 'error_evaluating_keybinding_context',
              tags: { context_key: name, owner: owners.get(name) }
            })
          }
          return undefined
        }
      })
      if (results.includes(undefined)) delete context[name]
      else context[name] = results.some(Boolean)
    }
    return context
  }

  function provide(name: string, owner: string, get: () => boolean) {
    if (!register(name, owner)) return () => {}
    providers.value = new Map(providers.value).set(
      name,
      new Set([...(providers.value.get(name) ?? []), get])
    )
    return () => {
      const remaining = new Set(providers.value.get(name))
      remaining.delete(get)
      providers.value = new Map(providers.value).set(name, remaining)
    }
  }

  return { register, set, ownerOf, snapshot, provide }
})
