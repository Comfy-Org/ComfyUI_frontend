import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { render, screen, waitFor } from '@testing-library/vue'

import enMessages from '@/locales/en/main.json'

import PlanCreditsPanelContent from './PlanCreditsPanelContent.vue'

const mockDistribution = vi.hoisted(() => ({ cloud: true }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockDistribution.cloud
  }
}))

const refreshSpy = vi.hoisted(() => vi.fn(() => Promise.resolve()))

// Held as a real ref so a test can revoke billing access after mount and the
// panel's own watcher reacts, the way a workspace switch does. The ref is
// created inside the factory because `vi.hoisted` runs before Vue is loaded.
const permission = vi.hoisted(() => ({
  canManage: null as unknown as Ref<boolean>
}))
vi.mock<unknown>(
  import('@/platform/workspace/composables/useWorkspaceUI'),
  async () => {
    const { computed, ref } = await import('vue')
    permission.canManage = ref(true)
    return {
      useWorkspaceUI: () => ({
        permissions: computed(() => ({
          canManageSubscription: permission.canManage.value
        }))
      })
    }
  }
)

const stubs = {
  SubscriptionPanelContentWorkspace: {
    template: '<section aria-label="Plan and credits overview" />'
  },
  WorkspaceInvoicesContent: {
    template: '<section aria-label="Invoices" />'
  },
  CreditsPanel: {
    props: ['embedded'],
    template: '<section aria-label="Local credits overview" />'
  },
  SubscriptionFooterLinks: {
    template: '<footer aria-label="Subscription links" />'
  },
  UsageLogsTable: {
    template: '<section aria-label="Usage logs" />',
    methods: {
      refresh: refreshSpy
    }
  }
}

function renderPanel({ cloud = true } = {}) {
  mockDistribution.cloud = cloud
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages }
  })
  return render(PlanCreditsPanelContent, { global: { plugins: [i18n], stubs } })
}

beforeEach(() => {
  permission.canManage.value = true
})

describe('PlanCreditsPanelContent', () => {
  it('shows Credits and Activity tabs with Credits active by default', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: 'Credits' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Activity' })).toBeTruthy()
    expect(
      screen.getByRole('region', { name: 'Plan and credits overview' })
    ).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Usage logs' })).toBeNull()
  })

  it('shows the existing credits UI instead of subscription plans on local', () => {
    renderPanel({ cloud: false })

    expect(
      screen.getByRole('region', { name: 'Local credits overview' })
    ).toBeTruthy()
    expect(
      screen.getByRole('contentinfo', { name: 'Subscription links' })
    ).toBeTruthy()
    expect(
      screen.queryByRole('region', { name: 'Plan and credits overview' })
    ).toBeNull()
  })

  it('loads the usage log on the Activity tab', async () => {
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: 'Activity' }))
    expect(screen.getByRole('region', { name: 'Usage logs' })).toBeTruthy()
    expect(
      screen.queryByRole('region', { name: 'Plan and credits overview' })
    ).toBeNull()
    await waitFor(() => expect(refreshSpy).toHaveBeenCalledOnce())
  })

  it('opens the Invoices tab for a billing manager', async () => {
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: 'Invoices' }))

    expect(screen.getByRole('region', { name: 'Invoices' })).toBeTruthy()
    expect(
      screen.queryByRole('region', { name: 'Plan and credits overview' })
    ).toBeNull()
  })

  it('hides Invoices from members who cannot manage billing', () => {
    permission.canManage.value = false
    renderPanel()

    expect(screen.queryByRole('button', { name: 'Invoices' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Activity' })).toBeTruthy()
  })

  it('leaves the Invoices view when billing access is revoked', async () => {
    renderPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Invoices' }))
    expect(screen.getByRole('region', { name: 'Invoices' })).toBeTruthy()

    permission.canManage.value = false
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Invoices' })).toBeNull()
    )
    expect(screen.queryByRole('button', { name: 'Invoices' })).toBeNull()
    expect(
      screen.getByRole('region', { name: 'Plan and credits overview' })
    ).toBeTruthy()
  })

  it('hides Invoices off cloud, where there is no upcoming charge to show', () => {
    renderPanel({ cloud: false })

    expect(screen.queryByRole('button', { name: 'Invoices' })).toBeNull()
  })

  it('reports usage-log refresh failures', async () => {
    refreshSpy.mockRejectedValueOnce(new Error('refresh failed'))
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: 'Activity' }))

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith('Error refreshing usage logs')
    )
  })
})
