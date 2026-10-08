/**
 * A recording stand-in for the cloud endpoints the workshop reads: what was
 * sent, per request, and what each rollout state answers.
 */
import { vi } from 'vitest'

import { COMFY_CLIENT } from '@comfyorg/account-core/requestAuth'

import { WORKSHOP_CLOUD_BASE_URL } from '@/config/workshop-env'
import type { WorkshopSession } from '@/config/workshop-session-state'

export const FEATURES = `${WORKSHOP_CLOUD_BASE_URL}/api/features`
export const SESSION = `${WORKSHOP_CLOUD_BASE_URL}/api/auth/session`
export const BALANCE = `${WORKSHOP_CLOUD_BASE_URL}/api/billing/balance`
export const TOKEN = `${WORKSHOP_CLOUD_BASE_URL}/api/auth/token`

export interface SentRequest {
  readonly method: string
  readonly url: string
  readonly credentials?: RequestCredentials
  readonly authorization?: string
  readonly workspace?: string
  readonly client?: string
}

export const SESSION_BALANCE_READ: SentRequest = {
  method: 'GET',
  url: BALANCE,
  credentials: 'include',
  client: COMFY_CLIENT
}

const LIVE_SESSION = {
  status: 200,
  body: {
    absolute_expires_at: '2099-01-01T00:00:00Z',
    has_personal_workspace: true,
    expires_at: '2099-01-01T00:00:00Z',
    csrf_token: 'csrf',
    user: {
      id: 'uid-1',
      email: 'ada@example.com',
      email_verified: true,
      name: 'Ada Lovelace'
    }
  }
}

export const SESSION_FLAGS = {
  anonymous: { web_session_probe: true },
  perUser: { unified_web_session: true },
  session: LIVE_SESSION
}

const BALANCE_211 = {
  status: 200,
  body: { amount_micros: 211, currency: 'usd', effective_balance_micros: 211 }
}

export function refusal(status: number, code: string) {
  return { status, body: { code, message: code } }
}

interface CloudAnswers {
  readonly anonymous: Record<string, unknown>
  readonly perUser?: Record<string, unknown>
  readonly session?: { readonly status: number; readonly body: unknown }
  readonly balance?: { readonly status: number; readonly body: unknown }
  readonly answered?: Promise<void>
}

function recordRequest(url: string, init: RequestInit = {}): SentRequest {
  const { credentials } = init
  const headers = new Headers(init.headers)
  const authorization = headers.get('Authorization')
  const workspace = headers.get('X-Comfy-Workspace-ID')
  const client = headers.get('X-Comfy-Client')
  return {
    method: init.method ?? 'GET',
    url,
    ...(credentials ? { credentials } : {}),
    ...(authorization ? { authorization } : {}),
    ...(workspace ? { workspace } : {}),
    ...(client ? { client } : {})
  }
}

export function stubCloud({
  anonymous,
  perUser = {},
  session = refusal(401, 'no_session'),
  balance = BALANCE_211,
  answered
}: CloudAnswers) {
  const sent: SentRequest[] = []
  const byUrl: Record<string, CloudAnswers['session']> = {
    [SESSION]: session,
    [BALANCE]: balance
  }
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input)
      sent.push(recordRequest(url, init))
      await answered
      const answer = byUrl[url] ?? {
        status: 200,
        body: init?.credentials === 'include' ? perUser : anonymous
      }
      return new Response(JSON.stringify(answer.body), {
        status: answer.status
      })
    })
  )
  return sent
}

export function credential(type: 'personal' | 'team'): WorkshopSession {
  return {
    token: 'workspace-jwt',
    expiresAt: Date.now() + 60_000,
    uid: 'uid-1',
    workspace: { id: 'workspace-1', name: 'Workspace', type },
    role: 'owner',
    permissions: []
  }
}
