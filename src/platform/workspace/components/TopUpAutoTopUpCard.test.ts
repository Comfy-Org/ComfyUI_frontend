import type { AutoTopUpSetup } from '@comfyorg/ingest-types'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { receiveServerFact } from '@/platform/serverFacts/serverFact'
import { reportError } from '@/platform/telemetry/reportError'
import type { AutoReloadSettings } from '@/platform/workspace/api/workspaceApi'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'

import TopUpAutoTopUpCard from './TopUpAutoTopUpCard.vue'

vi.mock(import('@/platform/workspace/api/workspaceApi'))
vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock<unknown>(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path: string) => `https://platform.test${path}`
}))

const PROMPT = 'Running low on credits? Turn on auto top-up.'

const off: AutoReloadSettings = {
  configured: false,
  cycle_resets_at: null,
  disabled_reason: null,
  enabled: false,
  last_failure_at: null,
  last_failure_reason: null,
  max_monthly_budget_cents: 100000,
  min_reload_credits: 1000,
  monthly_budget_cents: null,
  paused_by_budget: false,
  paused_by_decline: false,
  reload_amount_cents: null,
  reload_credits: null,
  spent_this_cycle_cents: 0,
  status: 'off',
  threshold_credits: null
}

type Served = {
  enabled: boolean
  canManage: boolean
  setup: AutoTopUpSetup | null
  status: AutoReloadSettings['status'] | 'read failed'
}

const shown: Served = {
  enabled: true,
  canManage: true,
  setup: { state: 'ready' },
  status: 'off'
}

async function renderCard(served: Partial<Served> = {}) {
  const { enabled, canManage, setup, status } = { ...shown, ...served }
  if (status === 'read failed') {
    vi.mocked(workspaceApi.getBillingAutoReload).mockRejectedValue(
      new Error('read failed')
    )
  } else {
    vi.mocked(workspaceApi.getBillingAutoReload).mockResolvedValue({
      ...off,
      status
    })
  }
  const capabilities = vi.mocked(useBillingCapabilities)()
  capabilities.autoTopUpEnabled = computed(() =>
    receiveServerFact('auto_top_up_enabled', enabled)
  )
  capabilities.canManageAutoTopUp = computed(() =>
    receiveServerFact('can_manage_auto_top_up', canManage)
  )
  capabilities.autoTopUpSetup = computed(() => setup)
  render(TopUpAutoTopUpCard, {
    global: {
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: { en: enMessages }
        })
      ]
    }
  })
  await vi.waitFor(() => Promise.resolve())
  await nextTick()
}

describe('TopUpAutoTopUpCard', () => {
  it('offers a manager with auto top-up off to set it up on the billing site', async () => {
    await renderCard()

    expect(await screen.findByText(PROMPT)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Set up' })).toHaveAttribute(
      'href',
      'https://platform.test/profile/billing'
    )
  })

  it.for<{ name: string } & Partial<Served>>([
    { name: 'auto top-up is not served', enabled: false },
    { name: 'the viewer cannot manage it', canManage: false },
    { name: 'no setup is served', setup: null },
    {
      name: 'setup is unavailable',
      setup: { state: 'unavailable', reason: 'workspace_blocked' }
    },
    {
      name: 'setup is frozen by a past-due payment',
      setup: { state: 'frozen', reason: 'payment_past_due' }
    },
    { name: 'auto top-up is already on', status: 'on' },
    { name: 'auto top-up has failed', status: 'failed' },
    { name: 'the status read failed', status: 'read failed' }
  ])('shows nothing when $name', async ({ name: _, ...served }) => {
    await renderCard(served)

    expect(screen.queryByText(PROMPT)).toBeNull()
  })

  it('stays shown while setup is frozen for another reason', async () => {
    await renderCard({ setup: { state: 'frozen', reason: 'billing_paused' } })

    expect(await screen.findByText(PROMPT)).toBeInTheDocument()
  })

  it('reads the auto top-up status only when the served facts allow setup', async () => {
    await renderCard({ canManage: false })
    expect(workspaceApi.getBillingAutoReload).not.toHaveBeenCalled()

    await renderCard()
    expect(workspaceApi.getBillingAutoReload).toHaveBeenCalledOnce()
  })

  it('reports a failed status read', async () => {
    await renderCard({ status: 'read failed' })

    await vi.waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ errorType: 'auto_top_up_read_failed' })
      )
    )
  })
})
