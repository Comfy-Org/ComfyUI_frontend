import { respondToFetch } from '@comfyorg/test-utils/fetch'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DesktopHostAuthState } from '@/platform/auth/desktopHost/desktopHostAuthBridge'
import {
  startDesktopHostSession,
  stopDesktopHostSession
} from '@/platform/auth/desktopHost/desktopHostSession'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingDialogs } from '@/platform/billing/composables/useBillingDialogs'
import { launchLocalBillingHandoff } from '@/platform/billing/localBillingHandoff'
import { useLocalBillingWebFlagStore } from '@/platform/billing/stores/localBillingWebFlagStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock(import('firebase/auth'))
vi.mock(import('@/i18n'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(
  import('@/platform/billing/subscription/composables/useSubscriptionDialog')
)
vi.mock(import('@/platform/billing/localBillingHandoff'), () => ({
  launchLocalBillingHandoff: vi.fn(async () => 'opened' as const)
}))

const distribution = vi.hoisted(() => ({ isCloud: false, isDesktop: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'localhost' as const,
  isNightly: false,
  get isCloud() {
    return distribution.isCloud
  },
  get isDesktop() {
    return distribution.isDesktop
  }
}))

const signedIn: DesktopHostAuthState = {
  status: 'signed_in',
  userId: 'user-1',
  workspaceId: 'ws-1'
}

async function signInWithFlag(localBillingWeb: boolean) {
  respondToFetch(/\/api\/features$/, () =>
    Response.json({ local_billing_web: localBillingWeb })
  )
  await startDesktopHostSession({
    getState: async () => signedIn,
    getWorkspaceToken: async () => 'token-ws-1',
    requestSignIn: async () => signedIn,
    signOut: async () => ({ status: 'signed_out' }),
    onChanged: () => () => {}
  })
  const flag = useLocalBillingWebFlagStore()
  await vi.waitFor(() => expect(flag.enabled).toBe(localBillingWeb))
}

describe('Add credits on local ComfyUI', () => {
  beforeEach(() => {
    Object.assign(distribution, { isCloud: false, isDesktop: false })
    vi.mocked(useTeamWorkspaceStore().initialize).mockResolvedValue()
  })

  afterEach(() => stopDesktopHostSession())

  it.for([
    { name: 'local web with the flag on', flag: true, handoffs: 1, dialogs: 0 },
    {
      name: 'local web with the flag off',
      flag: false,
      handoffs: 0,
      dialogs: 1
    },
    {
      name: 'a Desktop build with the flag on',
      flag: true,
      isDesktop: true,
      handoffs: 0,
      dialogs: 1
    }
  ])(
    '$name opens billing through $handoffs handoff(s)',
    async ({ flag, handoffs, dialogs, isDesktop = false }) => {
      await signInWithFlag(flag)
      distribution.isDesktop = isDesktop

      await useBillingDialogs().showTopUpCreditsDialog()

      expect(vi.mocked(launchLocalBillingHandoff).mock.calls).toEqual(
        Array.from({ length: handoffs }, () => ['top-up', expect.any(Function)])
      )
      expect(useDialogStore().showDialog).toHaveBeenCalledTimes(dialogs)
      expect(useBillingCapabilities().initialize).not.toHaveBeenCalled()
    }
  )
})
