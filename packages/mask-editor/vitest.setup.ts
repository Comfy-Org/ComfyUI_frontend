import { createTestingPinia } from '@pinia/testing'
import { disposePinia, setActivePinia } from 'pinia'
import { beforeEach, vi } from 'vitest'

beforeEach(() => {
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
  setActivePinia(pinia)
  return () => disposePinia(pinia)
})
