import { createEventHook } from '@vueuse/core'

import type { AuthMetadata } from '@/platform/telemetry/types'

export interface AuthEvent extends AuthMetadata {
  type: 'login' | 'register' | 'logout' | 'password_reset'
}

export interface UserResolvedEvent {
  userId: string
  email?: string | null
  displayName?: string | null
}

export const authEventHook = createEventHook<AuthEvent>()
export const userResolvedHook = createEventHook<UserResolvedEvent>()
