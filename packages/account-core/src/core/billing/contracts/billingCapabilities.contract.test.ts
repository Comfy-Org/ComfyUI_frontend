import { zBillingCapabilitiesResponse } from '@comfyorg/ingest-types/zod'
import type {
  zBillingCapabilities,
  zBillingCapabilityRolloutDefaults,
  zBillingCapabilityScope
} from '@comfyorg/ingest-types/zod'
import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'

type CapabilitiesResponseBody = z.input<typeof zBillingCapabilitiesResponse>
type CapabilitiesResponse = z.infer<typeof zBillingCapabilitiesResponse>
type Capabilities = z.infer<typeof zBillingCapabilities>
type CapabilityScope = z.infer<typeof zBillingCapabilityScope>
type RolloutDefaults = z.infer<typeof zBillingCapabilityRolloutDefaults>

function capabilities(): Capabilities {
  return {
    can_cancel: true,
    can_change_seats: true,
    can_downgrade_to_personal: false,
    can_invite_members: true,
    can_reactivate: false,
    can_revert_scheduled_change: false,
    can_subscribe_self_serve: true,
    can_top_up: true
  }
}

function capabilitiesBody(
  overrides: Partial<CapabilitiesResponseBody> = {}
): CapabilitiesResponseBody {
  return {
    capabilities: capabilities(),
    expires_at: '2024-06-15T12:01:00.000Z',
    resolved_for: { user_id: 'uid-1', workspace_id: 'ws-1' },
    revision: 42n,
    rollout_defaults_applied: {
      can_downgrade_to_personal: false,
      can_subscribe_self_serve: false,
      can_top_up: false
    },
    ...overrides
  }
}

// Compile-time pins: a regen that moves these fails the package typecheck.

// The five fields the reader composes its own schema from, plus two it leaves out.
expectTypeOf<keyof CapabilitiesResponse>().toEqualTypeOf<
  | 'capabilities'
  | 'denied_reasons'
  | 'expires_at'
  | 'resolved_for'
  | 'revision'
  | 'rollout_defaults_applied'
  | 'subscription_state_authoritative'
>()
expectTypeOf<Capabilities>().toEqualTypeOf<{
  can_cancel: boolean
  can_change_seats: boolean
  can_downgrade_to_personal: boolean
  can_invite_members: boolean
  can_reactivate: boolean
  can_revert_scheduled_change: boolean
  can_subscribe_self_serve: boolean
  can_top_up: boolean
}>()
expectTypeOf<CapabilityScope>().toEqualTypeOf<{
  user_id: string
  workspace_id: string
}>()
expectTypeOf<RolloutDefaults>().toEqualTypeOf<{
  can_downgrade_to_personal: boolean
  can_subscribe_self_serve: boolean
  can_top_up: boolean
}>()
// The expiry the reader paces freshness from; the revision it reads as a number.
expectTypeOf<CapabilitiesResponse['expires_at']>().toEqualTypeOf<string>()
expectTypeOf<CapabilitiesResponse['revision']>().toEqualTypeOf<bigint>()

describe('billing capabilities contract', () => {
  it('accepts the body the capabilities endpoint returns', () => {
    expect(
      zBillingCapabilitiesResponse.safeParse(capabilitiesBody())
    ).toMatchObject({ success: true })
  })

  it('requires a datetime expiry, which the reader re-decodes leniently as a plain string', () => {
    expect(
      zBillingCapabilitiesResponse.safeParse(
        capabilitiesBody({ expires_at: 'not-a-date' })
      ).success
    ).toBe(false)
  })

  it('bounds the revision to the safe range the reader reads it back as a number over', () => {
    const safe = { ...capabilitiesBody(), revision: Number.MAX_SAFE_INTEGER }
    const unsafe = capabilitiesBody({
      revision: BigInt(Number.MAX_SAFE_INTEGER) + 1n
    })

    expect(zBillingCapabilitiesResponse.safeParse(safe)).toMatchObject({
      success: true
    })
    expect(zBillingCapabilitiesResponse.safeParse(unsafe).success).toBe(false)
  })

  it('rejects an unrecognised denied reason, which the reader therefore decodes leniently off the raw body', () => {
    const known = capabilitiesBody({
      denied_reasons: { can_subscribe_self_serve: 'not_workspace_owner' }
    })
    const unknown = {
      ...capabilitiesBody(),
      denied_reasons: { can_subscribe_self_serve: 'something_new' }
    }

    expect(zBillingCapabilitiesResponse.safeParse(known)).toMatchObject({
      success: true
    })
    expect(zBillingCapabilitiesResponse.safeParse(unknown).success).toBe(false)
  })
})
