import { onTestFinished, vi } from 'vitest'

import type { useErrorHandling as realUseErrorHandling } from '../useErrorHandling'

const toastErrorHandler = vi.fn()

const defaults: ReturnType<typeof realUseErrorHandling> = {
  wrapWithErrorHandling:
    (action, errorHandler, finallyHandler) =>
    (...args) => {
      try {
        return action(...args)
      } catch (error) {
        ;(errorHandler ?? toastErrorHandler)(error)
      } finally {
        finallyHandler?.()
      }
    },
  wrapWithErrorHandlingAsync:
    (action, errorHandler, finallyHandler) =>
    async (...args) => {
      try {
        return await action(...args)
      } catch (error) {
        ;(errorHandler ?? toastErrorHandler)(error)
      } finally {
        finallyHandler?.()
      }
    },
  toastErrorHandler
}

const errorHandling = { ...defaults }

export const useErrorHandling = vi.fn(() => {
  onTestFinished(() => {
    Object.assign(errorHandling, defaults)
  })
  return errorHandling
})
