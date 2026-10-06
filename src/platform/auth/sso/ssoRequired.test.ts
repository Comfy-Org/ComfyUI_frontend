import { beforeAll, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import {
  presentForRefusal,
  presentForResponse,
  presentSsoRequired
} from '@/platform/auth/sso/ssoRequired'
import { SSO_REQUIRED_DIALOG_KEY } from '@/platform/auth/sso/ssoRequiredDialogKey'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock(import('@/composables/useFeatureFlags'))

const SSO_REFUSAL = {
  code: 'sso_required',
  message: "This account signs in with your organization's single sign-on"
}

async function shownDialog() {
  await vi.dynamicImportSettled()
  return useDialogStore().dialogStack.find(
    (dialog) => dialog.key === SSO_REQUIRED_DIALOG_KEY
  )
}

describe('the SSO-required screen', () => {
  beforeAll(() => import('@/platform/auth/sso/SsoRequiredDialogContent.vue'))

  it('stays hidden with the flag off, so the caller keeps its handling', async () => {
    expect(presentSsoRequired({ email: 'ada@acme.com' })).toBe(false)
    expect(await shownDialog()).toBeUndefined()
  })

  it('opens once with the flag on, keeping what any caller knew', async () => {
    vi.mocked(useFeatureFlags().flags).ssoEnabled = true

    expect(presentSsoRequired()).toBe(true)
    await shownDialog()
    expect(presentSsoRequired({ email: 'ada@acme.com', returnTo: '/x' })).toBe(
      true
    )
    expect(presentSsoRequired({ email: undefined })).toBe(true)

    const dialog = await shownDialog()
    expect(dialog?.contentProps).toEqual({
      email: 'ada@acme.com',
      returnTo: '/x'
    })
    expect(useDialogStore().dialogStack).toHaveLength(1)
  })

  it.for<{ name: string; status: number; body: unknown; shown: boolean }>([
    { name: 'a 403 sso_required', status: 403, body: SSO_REFUSAL, shown: true },
    {
      name: 'another 403',
      status: 403,
      body: { code: 'FORBIDDEN', message: 'x' },
      shown: false
    },
    {
      name: 'a 401 sso_required',
      status: 401,
      body: SSO_REFUSAL,
      shown: false
    },
    { name: 'a 403 without a body', status: 403, body: undefined, shown: false }
  ])('presents for $name: $shown', async ({ status, body, shown }) => {
    vi.mocked(useFeatureFlags().flags).ssoEnabled = true

    expect(presentForRefusal(status, body)).toBe(shown)
    expect(Boolean(await shownDialog())).toBe(shown)
  })

  it.for<{ name: string; body: unknown; context: object }>([
    {
      name: 'the organization a refusal names',
      body: { ...SSO_REFUSAL, organization_id: 'org_meta' },
      context: { organizationId: 'org_meta' }
    },
    {
      name: 'no organization when none is named',
      body: SSO_REFUSAL,
      context: {}
    }
  ])('passes $name to the screen', async ({ body, context }) => {
    vi.mocked(useFeatureFlags().flags).ssoEnabled = true

    expect(await presentForResponse(Response.json(body, { status: 403 }))).toBe(
      true
    )
    expect((await shownDialog())?.contentProps).toEqual(context)
  })

  it('stays hidden with the flag off even when the refusal names an organization', async () => {
    const body = { ...SSO_REFUSAL, organization_id: 'org_meta' }

    expect(presentForRefusal(403, body)).toBe(false)
    expect(await shownDialog()).toBeUndefined()
  })

  it('reads a 403 response through a clone, leaving it for the caller', async () => {
    vi.mocked(useFeatureFlags().flags).ssoEnabled = true
    const response = Response.json(SSO_REFUSAL, { status: 403 })

    expect(await presentForResponse(response)).toBe(true)
    expect(await response.json()).toEqual(SSO_REFUSAL)
    expect(await shownDialog()).toBeDefined()
  })

  it('leaves a response unread with the flag off', async () => {
    const response = Response.json(SSO_REFUSAL, { status: 403 })
    const clone = vi.spyOn(response, 'clone')

    expect(await presentForResponse(response)).toBe(false)
    expect(clone).not.toHaveBeenCalled()
    expect(await shownDialog()).toBeUndefined()
  })
})
