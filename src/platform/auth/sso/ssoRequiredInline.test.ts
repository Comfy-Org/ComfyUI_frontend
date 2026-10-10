import { render, screen } from '@testing-library/vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { presentSsoRequired } from '@/platform/auth/sso/ssoRequired'
import { SSO_REQUIRED_DIALOG_KEY } from '@/platform/auth/sso/ssoRequiredDialogKey'
import { useSsoRequiredInlineHost } from '@/platform/auth/sso/ssoRequiredInline'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock(import('@/composables/useFeatureFlags'))

const AuthPage = defineComponent({
  setup() {
    const { notice } = useSsoRequiredInlineHost()
    return () => h('pre', JSON.stringify(notice.value ?? null))
  }
})

async function dialogShown() {
  await vi.dynamicImportSettled()
  return useDialogStore().dialogStack.some(
    (dialog) => dialog.key === SSO_REQUIRED_DIALOG_KEY
  )
}

describe('the SSO-required notice on an auth page', () => {
  afterEach(() => {
    useDialogStore().closeDialog({ key: SSO_REQUIRED_DIALOG_KEY })
  })

  it('shows on the page instead of the shared dialog, keeping what each caller knew', async () => {
    vi.mocked(useFeatureFlags().flags).ssoEnabled = true
    render(AuthPage)

    expect(presentSsoRequired({ email: 'ada@acme.com' })).toBe(true)
    expect(presentSsoRequired({ organizationId: 'org_meta' })).toBe(true)

    expect(
      await screen.findByText(
        JSON.stringify({ email: 'ada@acme.com', organizationId: 'org_meta' })
      )
    ).toBeInTheDocument()
    expect(await dialogShown()).toBe(false)
  })

  it('falls back to the dialog once the page is gone', async () => {
    vi.mocked(useFeatureFlags().flags).ssoEnabled = true
    const page = render(AuthPage)
    page.unmount()

    expect(presentSsoRequired({ email: 'ada@acme.com' })).toBe(true)
    expect(await dialogShown()).toBe(true)
  })

  it('stays hidden with the flag off', async () => {
    vi.mocked(useFeatureFlags().flags).ssoEnabled = false
    render(AuthPage)

    expect(presentSsoRequired({ email: 'ada@acme.com' })).toBe(false)
    expect(screen.getByText('null')).toBeInTheDocument()
  })
})
