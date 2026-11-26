import {
  createPinia,
  disposePinia,
  getActivePinia,
  setActivePinia
} from 'pinia'
import type { Pinia } from 'pinia'
import { test as base } from 'vitest'

export function createDisposablePinia() {
  const pinia = createPinia()
  return {
    pinia,
    [Symbol.dispose]() {
      disposePinia(pinia)
      if (getActivePinia() === pinia) setActivePinia(undefined)
    }
  }
}

export const test = base.extend<{ pinia: Pinia }>({
  // oxlint-disable-next-line eslint/no-empty-pattern -- Vitest rejects fixture arguments without object destructuring.
  pinia: async ({}, use) => {
    using owner = createDisposablePinia()
    await use(owner.pinia)
  }
})
