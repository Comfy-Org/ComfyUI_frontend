import type {
  AgentAskConflict,
  ErrorResponse,
  ExchangeTokenResponse,
  HubProfile
} from '@comfyorg/ingest-types'
import {
  zAgentAskConflict,
  zBillingStatusResponse,
  zErrorResponse,
  zExchangeTokenResponse,
  zHubProfile
} from '@comfyorg/ingest-types/zod'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'

expectTypeOf<
  z.infer<typeof zAgentAskConflict>
>().toEqualTypeOf<AgentAskConflict>()
expectTypeOf<z.infer<typeof zErrorResponse>>().toEqualTypeOf<ErrorResponse>()
expectTypeOf<
  z.infer<typeof zExchangeTokenResponse>
>().toEqualTypeOf<ExchangeTokenResponse>()
expectTypeOf<z.infer<typeof zHubProfile>>().toEqualTypeOf<HubProfile>()

describe('ingest API schemas', () => {
  it.for([
    {
      consumer: 'agent',
      schema: zAgentAskConflict,
      body: { error: 'ask already resolved', status: 'expired' }
    },
    {
      consumer: 'authentication',
      schema: zExchangeTokenResponse,
      body: {
        expires_at: '2026-10-30T12:00:00Z',
        permissions: ['workflow:run'],
        role: 'member',
        token: 'jwt',
        user_id: 'user-1',
        workspace: { id: 'ws-1', name: 'Studio', type: 'team' }
      }
    },
    {
      consumer: 'billing',
      schema: zBillingStatusResponse,
      body: {
        has_funds: true,
        is_active: true,
        max_seats: 5,
        occupied_seats: 2,
        ended_at: null,
        scheduled_change: null,
        team_credit_stop: null
      }
    },
    {
      consumer: 'workflow-sharing',
      schema: zHubProfile,
      body: { username: 'comfy-artist' }
    },
    {
      consumer: 'every caller reading a refusal',
      schema: zErrorResponse,
      body: { code: 'sso_required', message: 'Use SSO' }
    }
  ])(
    'keeps parsing the $consumer contract when the server adds a field, and drops the field',
    ({ schema, body }) => {
      expect(schema.parse({ ...body, added_in_a_later_release: 1 })).toEqual(
        body
      )
    }
  )
})
