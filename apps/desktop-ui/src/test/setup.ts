import '@testing-library/jest-dom/vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach } from 'vitest'

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
})
