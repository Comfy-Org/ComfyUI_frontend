import { assert } from '@/base/assert'
import type { ComfyApp } from '@/types/comfy'

let instance: ComfyApp | undefined

/**
 * Called once by `@/scripts/app` after it constructs the singleton. Modules
 * that the app imports cannot import `@/scripts/app` back without a cycle, so
 * they reach the instance through `useApp` from `@/scripts/appInstance`.
 */
export function registerApp(app: ComfyApp) {
  instance = app
}

export function useApp(): ComfyApp {
  if (!instance) {
    const message = 'ComfyApp accessed before registerApp'
    assert(false, message)
    throw new TypeError(message)
  }
  return instance
}
