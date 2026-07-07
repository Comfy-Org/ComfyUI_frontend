import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/vue'
import { afterEach } from 'vitest'

// happy-dom does not expose localStorage here, but composables persist small prefs through
// VueUse's useStorage. A minimal Map-backed Storage keeps that behavior real (and testable)
// in the unit environment.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>()
  const localStorage: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(key, String(value))
  }
  globalThis.localStorage = localStorage
  if (typeof window !== 'undefined') window.localStorage = localStorage
}

// Unmount and clean up the DOM between component tests so they stay isolated.
afterEach(() => {
  cleanup()
})
