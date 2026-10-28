import { CREDITS_ROUTE } from '@comfyorg/account-core/billing'
import type {
  AccountCredential,
  SessionSnapshot
} from '@comfyorg/account-core/session'
import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import { beforeEach, expect, it, vi } from 'vitest'

import { useWorkspaceAuthStore } from '@/platform/workspace/stores/workspaceAuthStore'
import {
  stubAccountIdentityPort,
  stubFirebaseAuthHarness
} from '@/utils/__tests__/stubAccountIdentityPort'

import { useBillingSdkStore } from './billingSdkStore'

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/settings/composables/useSettingsDialog'))
vi.mock(import('firebase/auth'))

const CREDENTIAL: AccountCredential = {
  token: 'workspace-jwt',
  expiresAt: Date.now() + 60 * 60 * 1000,
  uid: 'uid-1',
  workspace: { id: 'ws-1', name: 'Personal', type: 'personal' },
  role: 'owner',
  permissions: ['workspace:read']
}

const SNAPSHOT: SessionSnapshot<User> = {
  phase: 'authenticated',
  user: fromPartial<User>({ uid: 'uid-1' }),
  session: CREDENTIAL
}

beforeEach(() => {
  stubAccountIdentityPort()
  stubFirebaseAuthHarness()
  const session = useWorkspaceAuthStore().getUnifiedSessionClient()
  vi.spyOn(session, 'getSnapshot').mockReturnValue(SNAPSHOT)
  vi.spyOn(session, 'ensureFresh').mockResolvedValue({
    status: 'ok',
    session: CREDENTIAL
  })
})

it('reads the balance again after a 503 through the store wiring', async () => {
  vi.useFakeTimers()
  const answers = [
    new Response(null, { status: 503 }),
    Response.json({ amount_micros: 1_000_000, currency: 'USD' })
  ]
  vi.mocked(fetch).mockImplementation(async (input) => {
    expect(String(input)).toContain(CREDITS_ROUTE)
    const answer = answers.shift()
    if (!answer) throw new Error('fetch called more times than scripted')
    return answer
  })

  const pending = useBillingSdkStore().readBalance()
  await vi.advanceTimersByTimeAsync(10_000)

  expect(await pending).toMatchObject({
    status: 'ok',
    value: { amount_micros: 1_000_000 }
  })
  expect(fetch).toHaveBeenCalledTimes(2)
})
