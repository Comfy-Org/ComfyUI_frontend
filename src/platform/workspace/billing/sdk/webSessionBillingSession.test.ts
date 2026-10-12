import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { WebSessionErrorCode } from '@comfyorg/account-core/webSession'

import type { WebSessionRequests } from '@/platform/auth/session/webSessionFetch'
import { createWebSessionBillingSession } from '@/platform/workspace/billing/sdk/webSessionBillingSession'

vi.mock(import('firebase/auth'))

function refusedWith(code: WebSessionErrorCode) {
  const failure = {
    status: 'error',
    code,
    retryable: false,
    httpStatus: 403
  } as const
  return createWebSessionBillingSession(
    fromPartial<WebSessionRequests>({
      scope: async () => fromPartial({ epoch: 1 }),
      workspaceToken: async () => failure,
      remintWorkspaceToken: async () => failure
    })
  )
}

describe('the web-session billing session', () => {
  it.for([
    ['SSO_REQUIRED', 'SSO_REQUIRED'],
    ['WORKSPACE_ACCESS_DENIED', 'ACCESS_DENIED'],
    ['SESSION_UNAVAILABLE', 'TOKEN_EXCHANGE_FAILED']
  ] as const)(
    'reports a %s mint refusal to billing as %s',
    async ([code, expected]) => {
      const session = refusedWith(code)

      expect(await session.ensureFresh(undefined)).toEqual({
        status: 'error',
        code: expected,
        httpStatus: 403
      })
      expect(await session.remint(undefined)).toEqual({
        status: 'error',
        code: expected,
        httpStatus: 403
      })
    }
  )
})
