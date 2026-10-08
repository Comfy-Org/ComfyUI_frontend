import { describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { presentSsoRequired } from '@/platform/auth/sso/ssoRequired'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/platform/auth/sso/SsoRequiredDialogContent.vue'), () => {
  throw new Error('Failed to fetch dynamically imported module')
})

describe('the SSO-required screen when its chunk fails to load', () => {
  it('reports the failure and still tells the person to use SSO', async () => {
    vi.mocked(useFeatureFlags().flags).ssoEnabled = true

    expect(presentSsoRequired()).toBe(true)
    await vi.waitFor(() =>
      expect(useToastStore().messagesToAdd).toEqual([
        expect.objectContaining({
          severity: 'error',
          summary: 'Your organization requires single sign-on',
          detail: expect.stringContaining('Continue with SSO')
        })
      ])
    )
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ surface: 'auth' })
    )
  })
})
