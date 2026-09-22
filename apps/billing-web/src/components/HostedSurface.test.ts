import { render, screen } from '@testing-library/vue'

import type { AccountCredential } from '@comfyorg/account-core/session'
import { parseBillingEntry } from '@comfyorg/billing-contract'

import HostedSurface from '@/components/HostedSurface.vue'
import { recordBillingEntry } from '@/entry/billingEntry'
import { createBillingI18n } from '@/i18n'

const h = vi.hoisted(() => ({
  session: undefined as AccountCredential | undefined,
  bound: undefined as string | undefined
}))

vi.mock(import('@/entry/workspaceBinding'), () => ({
  boundWorkspaceId: () => h.bound,
  bindEntryWorkspace: () => false
}))

vi.mock(import('@/session/billingWebSession'), async () => {
  const { computed } = await import('vue')
  return {
    useBillingWebSession: () => ({
      phase: computed(() => (h.session ? 'authenticated' : 'signed-out')),
      user: computed(() => null),
      session: computed(() => h.session),
      failure: computed(() => undefined)
    })
  }
})

function teamSession(): AccountCredential {
  return {
    token: 'jwt-1',
    permissions: [],
    expiresAt: Date.now() + 3_600_000,
    uid: 'uid-1',
    workspace: { id: 'ws-team', name: 'Acme Team', type: 'team' },
    role: 'owner'
  }
}

function renderSurface() {
  return render(HostedSurface, {
    slots: { default: '<p>surface content</p>' },
    global: { plugins: [createBillingI18n()] }
  })
}

describe('HostedSurface', () => {
  beforeEach(() => {
    recordBillingEntry(
      parseBillingEntry(
        '/v1/subscription?product=comfyui&return_to=comfyui_credits'
      )
    )
    h.session = undefined
    h.bound = undefined
  })

  it('shows the surface the intent asked for', () => {
    renderSurface()

    expect(screen.getByText('surface content')).toBeInTheDocument()
  })

  it('links back to the product that sent the visitor here', () => {
    renderSurface()

    expect(
      screen.getByRole('link', { name: 'Return to ComfyUI' })
    ).toHaveAttribute(
      'href',
      'https://testcloud.comfy.org/?settings=plan-credits'
    )
  })

  it('sends the visitor back into the workspace the session was minted for', () => {
    h.session = teamSession()
    h.bound = 'ws-other'

    renderSurface()

    expect(
      screen.getByRole('link', { name: 'Return to ComfyUI' })
    ).toHaveAttribute(
      'href',
      'https://testcloud.comfy.org/?settings=plan-credits&workspace=ws-team'
    )
  })

  it('names the workspace the entry bound before the session is minted', () => {
    h.bound = 'ws-bound'

    renderSurface()

    expect(
      screen.getByRole('link', { name: 'Return to ComfyUI' })
    ).toHaveAttribute(
      'href',
      'https://testcloud.comfy.org/?settings=plan-credits&workspace=ws-bound'
    )
  })

  it('offers no way back when the arriving link named no destination', () => {
    recordBillingEntry(undefined)

    renderSurface()

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('names which workspace is being billed once the session names one', () => {
    h.session = teamSession()

    renderSurface()

    expect(screen.getByText('Billing for Acme Team')).toBeInTheDocument()
  })

  it('shows no workspace name before the session is authenticated', () => {
    renderSurface()

    expect(screen.queryByText(/^Billing for/)).not.toBeInTheDocument()
  })
})
