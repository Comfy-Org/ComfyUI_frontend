/**
 * The Workshop's account-layer wiring: one session client from
 * @comfyorg/account, bound to the env-selected Cloud origin. The credential
 * cache sits in sessionStorage so a token survives a reload but never
 * outlives the tab, and never crosses signed-in users (the client keys it
 * by uid).
 */
import type { User } from 'firebase/auth'

import type { SessionClient } from '@comfyorg/account/core'
import { createSessionClient } from '@comfyorg/account/core'

import { WORKSHOP_CLOUD_BASE_URL } from './workshop-env'

const STORAGE_KEY = 'comfy.workshop.session.v1'

const storage = {
  read(): string | null {
    try {
      return globalThis.sessionStorage?.getItem(STORAGE_KEY) ?? null
    } catch {
      // Storage that throws outright (cookies disabled) behaves as no cache.
      return null
    }
  },
  write(value: string): void {
    try {
      globalThis.sessionStorage?.setItem(STORAGE_KEY, value)
    } catch {
      // A session that only lives in memory still works for this page.
    }
  },
  clear(): void {
    try {
      globalThis.sessionStorage?.removeItem(STORAGE_KEY)
    } catch {
      // Nothing to clear if storage is unavailable.
    }
  }
}

export const workshopSessionClient: SessionClient<User> =
  createSessionClient<User>({
    exchangeUrl: `${WORKSHOP_CLOUD_BASE_URL}/api/auth/token`,
    storage
  })
