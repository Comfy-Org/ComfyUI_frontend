import { vi } from 'vitest'

vi.mock('vue-i18n', () => {
  return {
    useI18n: vi.fn()
  }
})

vi.mock('jsondiffpatch', () => {
  return {
    diff: vi.fn()
  }
})
