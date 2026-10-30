import type { AutoTopUpSetup } from '@comfyorg/ingest-types'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useTelemetry } from '@comfyorg/telemetry'
import {
  autoTopUpCardState,
  loadedAutoTopUp
} from '@/platform/billing/composables/__mocks__/useBillingAutoTopUpCard'
import {
  autoTopUpEnabledFact,
  canManageAutoTopUpFact
} from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import { useBillingAutoTopUpCard } from '@/platform/billing/composables/useBillingAutoTopUpCard'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

import TopUpAutoTopUpCard from './TopUpAutoTopUpCard.vue'

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/billing/composables/useBillingAutoTopUpCard'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path: string, correlationId?: string) =>
    `https://platform.test${path}?correlation_id=${correlationId}`
}))

const PROMPT = 'Running low on credits? Turn on auto top-up.'

type Served = {
  enabled: boolean
  canManage: boolean
  setup: AutoTopUpSetup | null
  card: ReturnType<typeof loadedAutoTopUp> | { kind: 'loading' | 'unavailable' }
}

const shown: Served = {
  enabled: true,
  canManage: true,
  setup: { state: 'ready' },
  card: loadedAutoTopUp('off')
}

function renderCard(served: Partial<Served> = {}) {
  const { enabled, canManage, setup, card } = { ...shown, ...served }
  const capabilities = useBillingCapabilities()
  capabilities.autoTopUpEnabled = autoTopUpEnabledFact(enabled)
  capabilities.canManageAutoTopUp = canManageAutoTopUpFact(canManage)
  capabilities.autoTopUpSetup = computed(() => setup)
  autoTopUpCardState.value = card
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
}

describe('TopUpAutoTopUpCard', () => {
  it('offers a manager with auto top-up off to set it up on the billing site', () => {
    renderCard()

    expect(screen.getByText(PROMPT)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Set up' })).toHaveAttribute(
      'href',
      expect.stringContaining('https://platform.test/profile/billing')
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
    { name: 'auto top-up is already on', card: loadedAutoTopUp('on') },
    { name: 'auto top-up has failed', card: loadedAutoTopUp('failed') },
    { name: 'the status is still loading', card: { kind: 'loading' } },
    { name: 'the status read failed', card: { kind: 'unavailable' } }
  ])('shows nothing when $name', ({ name: _, ...served }) => {
    renderCard(served)

    expect(screen.queryByText(PROMPT)).toBeNull()
  })

  it('stays shown while setup is frozen for another reason', () => {
    renderCard({ setup: { state: 'frozen', reason: 'billing_paused' } })

    expect(screen.getByText(PROMPT)).toBeInTheDocument()
  })

  it('reads the auto top-up status only when the served facts allow setup', () => {
    renderCard({ canManage: false })
    expect(useBillingAutoTopUpCard().ensureRead).not.toHaveBeenCalled()

    renderCard()
    expect(useBillingAutoTopUpCard().ensureRead).toHaveBeenCalledOnce()
  })

  it('reports the hand-off to the billing site', async () => {
    renderCard()

    await userEvent.click(screen.getByRole('link', { name: 'Set up' }))

    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'platform_handoff',
        target: 'auto_top_up',
        action: 'turn_on'
      })
    )
  })
})
