import '@testing-library/jest-dom/vitest'
import { createTestingPinia } from '@pinia/testing'
import { cleanup } from '@testing-library/vue'
import { disposePinia, setActivePinia } from 'pinia'
import { beforeEach, vi } from 'vitest'

beforeEach(() => {
  const pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
  setActivePinia(pinia)
  return () => {
    cleanup()
    disposePinia(pinia)
  }
})
