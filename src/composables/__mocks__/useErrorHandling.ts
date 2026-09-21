import { onTestFinished, vi } from 'vitest'

import type { useErrorHandling as realUseErrorHandling } from '../useErrorHandling'

const defaults: ReturnType<typeof realUseErrorHandling> = {
  wrapWithErrorHandling: (action) => action,
  wrapWithErrorHandlingAsync:
    (action) =>
    async (...args) =>
      action(...args),
  toastErrorHandler: vi.fn()
}

const errorHandling = { ...defaults }

export const useErrorHandling = vi.fn(() => {
  onTestFinished(() => {
    Object.assign(errorHandling, defaults)
  })
  return errorHandling
})
