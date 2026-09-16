import { describe, expect, it } from 'vitest'

import { SESSION_ERROR_MESSAGES } from '@comfyorg/account/session'
import type { SessionErrorCode } from '@comfyorg/account/session'

import enMessages from '@/locales/en/main.json'

const WORKSPACE_AUTH_KEY_BY_CODE: Record<
  SessionErrorCode,
  keyof (typeof enMessages)['workspaceAuth']['errors']
> = {
  NOT_AUTHENTICATED: 'notAuthenticated',
  INVALID_FIREBASE_TOKEN: 'invalidFirebaseToken',
  ACCESS_DENIED: 'accessDenied',
  WORKSPACE_NOT_FOUND: 'workspaceNotFound',
  TOKEN_EXCHANGE_FAILED: 'tokenExchangeFailed'
}

describe('shared auth copy stays in step with the locale source', () => {
  it.for(Object.entries(WORKSPACE_AUTH_KEY_BY_CODE))(
    'workspaceAuth.errors.%s matches the shared session copy',
    ([code, key]) => {
      expect(
        enMessages.workspaceAuth.errors[key],
        'the package table and this locale entry are one vocabulary; edits go to both or the surfaces drift'
      ).toBe(SESSION_ERROR_MESSAGES[code as SessionErrorCode])
    }
  )
})
