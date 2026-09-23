import type { CapabilitiesSnapshot } from '@comfyorg/account-core/billing'
import { describe, expect, it } from 'vitest'

import { projectBillingCapabilities } from './billingCapabilitiesView'

const SNAPSHOT: CapabilitiesSnapshot = {
  capabilities: {
    can_cancel: true,
    can_change_seats: false,
    can_downgrade_to_personal: false,
    can_invite_members: true,
    can_reactivate: false,
    can_subscribe_self_serve: true,
    can_top_up: true
  },
  denials: {},
  rolloutDefaultsApplied: {
    can_downgrade_to_personal: false,
    can_subscribe_self_serve: true,
    can_top_up: false
  },
  revision: 41,
  scope: {
    userId: 'canonical-user-1',
    workspaceId: 'workspace-1',
    role: 'owner'
  },
  freshUntil: Date.parse('2026-10-01T00:00:00.000Z')
}

describe('projectBillingCapabilities', () => {
  it('reads the snapshot back as the response the composable holds', () => {
    expect(projectBillingCapabilities(SNAPSHOT)).toStrictEqual({
      capabilities: SNAPSHOT.capabilities,
      expires_at: '2026-10-01T00:00:00.000Z',
      resolved_for: {
        user_id: 'canonical-user-1',
        workspace_id: 'workspace-1'
      },
      revision: 41,
      rollout_defaults_applied: SNAPSHOT.rolloutDefaultsApplied
    })
  })
})
