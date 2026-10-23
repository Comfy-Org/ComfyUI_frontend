import { describe, expect, it } from 'vitest'

import type { CapabilitiesSnapshot } from '@comfyorg/account-core/billing'

import { projectBillingCapabilities } from './billingCapabilitiesView'

const SNAPSHOT: CapabilitiesSnapshot = {
  capabilities: {
    can_cancel: true,
    can_change_seats: false,
    can_downgrade_to_personal: false,
    can_invite_members: true,
    can_manage_members: true,
    can_delete_workspace: false,
    can_leave_workspace: false,
    can_manage_billing: false,
    can_manage_partner_node_access: false,
    can_view_pending_invites: false,
    can_view_team_usage: false,
    can_edit_workspace: false,
    can_manage_auto_top_up: false,
    can_manage_subscription: false,
    can_open_plans: false,
    can_run_workflows: false,
    can_upgrade: false,
    can_reactivate: false,
    can_revert_scheduled_change: false,
    can_subscribe_self_serve: true,
    can_top_up: true
  },
  denials: {
    can_delete_workspace: 'personal_workspace',
    can_leave_workspace: 'personal_workspace_creator'
  },
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
      denied_reasons: SNAPSHOT.denials,
      expires_at: '2026-10-01T00:00:00.000Z',
      resolved_for: {
        user_id: 'canonical-user-1',
        workspace_id: 'workspace-1'
      },
      revision: 41,
      rollout_defaults_applied: SNAPSHOT.rolloutDefaultsApplied
    })
  })

  it.for([true, false])(
    'passes payment_recovery_available %s through to the capabilities read',
    (served) => {
      expect(
        projectBillingCapabilities({
          ...SNAPSHOT,
          paymentRecoveryAvailable: served
        }).payment_recovery_available
      ).toBe(served)
    }
  )

  it.for([true, false])(
    'passes has_parked_billing_operation %s through to the capabilities read',
    (served) => {
      expect(
        projectBillingCapabilities({
          ...SNAPSHOT,
          hasParkedBillingOperation: served
        }).has_parked_billing_operation
      ).toBe(served)
    }
  )

  it('omits has_parked_billing_operation when the snapshot has no value', () => {
    expect(
      projectBillingCapabilities({
        ...SNAPSHOT,
        hasParkedBillingOperation: undefined
      })
    ).not.toHaveProperty('has_parked_billing_operation')
  })
})
