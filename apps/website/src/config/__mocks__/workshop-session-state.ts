import { onTestFinished, vi } from 'vitest'
import { computed } from 'vue'

import type * as realSession from '../workshop-session-state'

type Session = ReturnType<typeof realSession.useWorkshopSession>

function defaults() {
  return {
    user: computed<Session['user']['value']>(() => null),
    session: computed<Session['session']['value']>(() => undefined),
    sessionFailure: computed<Session['sessionFailure']['value']>(
      () => undefined
    ),
    settled: computed(() => true),
    signedIn: computed(() => state.session.value !== undefined)
  }
}

const state: Session = {
  ...defaults(),
  ensureFresh: vi.fn(async () => undefined),
  remint: vi.fn(async () => undefined),
  signOut: vi.fn(async () => {})
}

const session: typeof realSession = {
  REMEMBERED_WORKSPACE_KEY: 'workshop:workspace',
  useWorkshopSession: vi.fn(() => {
    onTestFinished(() => {
      Object.assign(state, defaults())
    })
    return state
  })
}

export const { REMEMBERED_WORKSPACE_KEY, useWorkshopSession } = session
export type {
  WorkshopSession,
  WorkshopSessionUser
} from '../workshop-session-state'
