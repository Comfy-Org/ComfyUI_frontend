import type {
  AccountCredential,
  SessionSnapshot
} from '@comfyorg/account-core/session'
import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import { stubAccountIdentityPort } from '@/utils/__tests__/stubAccountIdentityPort'

import { useBillingSdkStore } from './billingSdkStore'
import { cloudJwtFor } from './billingSdkTestUtils'

vi.mock(import('@/composables/billing/useBillingContext'))

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock(import('@/platform/settings/composables/useSettingsDialog'))

vi.mock(import('@/platform/telemetry'))

vi.mock(import('@/composables/useFeatureFlags'))

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))

vi.mock(import('firebase/auth'))

const FIREBASE_UID = 'firebase-uid'
const COMFY_USER_ID = 'comfy-user-id'

const CREDENTIAL: AccountCredential = {
  token: cloudJwtFor(COMFY_USER_ID),
  expiresAt: Date.now() + 60 * 60 * 1000,
  uid: FIREBASE_UID,
  workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
  role: 'owner',
  permissions: []
}

const SNAPSHOT: SessionSnapshot<User> = {
  phase: 'authenticated',
  user: fromPartial<User>({ uid: FIREBASE_UID }),
  session: CREDENTIAL
}

const CAPABILITIES = {
  capabilities: {
    can_cancel: false,
    can_change_seats: false,
    can_downgrade_to_personal: false,
    can_invite_members: false,
    can_manage_members: false,
    can_reactivate: false,
    can_revert_scheduled_change: false,
    can_subscribe_self_serve: true,
    can_top_up: true
  },
  expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  resolved_for: { user_id: COMFY_USER_ID, workspace_id: 'ws-1' },
  revision: 1,
  rollout_defaults_applied: {
    can_downgrade_to_personal: false,
    can_subscribe_self_serve: false,
    can_top_up: false
  }
}

describe('useBillingSdkStore on the token session', () => {
  beforeEach(() => {
    stubAccountIdentityPort()
    vi.mocked(useBillingContext).mockReturnValue(useBillingContext())
    vi.mocked(fetch).mockImplementation(
      async () =>
        new Response(JSON.stringify(CAPABILITIES), {
          status: 200
        })
    )
    const session = useWorkspaceAuthStore().getUnifiedSessionClient()
    vi.spyOn(session, 'getSnapshot').mockReturnValue(SNAPSHOT)
    vi.spyOn(session, 'ensureFresh').mockResolvedValue({
      status: 'ok',
      session: CREDENTIAL
    })
  })

  it('accepts capabilities resolved for the Comfy user its token names when that is not the Firebase uid', async () => {
    const result = await useBillingSdkStore().readCapabilities({})

    expect(result).toMatchObject({
      status: 'ok',
      value: {
        capabilities: { can_subscribe_self_serve: true },
        resolved_for: { user_id: COMFY_USER_ID, workspace_id: 'ws-1' }
      }
    })
  })
})
