import { createEventHook } from '@vueuse/core'

export interface UserIdentity {
  userId: string
}

export interface AuthEvent {
  event: 'login' | 'register' | 'logout'
  method: 'email' | 'google' | 'github'
  isNewUser: boolean
}

/**
 * Event hook for user identity changes.
 * Telemetry subscribes to this instead of importing useCurrentUser directly.
 */
export const userIdentityHook = createEventHook<UserIdentity>()

/**
 * Event hook for auth events (login, register, logout).
 * Telemetry subscribes to track auth events without auth importing telemetry.
 */
export const authEventHook = createEventHook<AuthEvent>()
