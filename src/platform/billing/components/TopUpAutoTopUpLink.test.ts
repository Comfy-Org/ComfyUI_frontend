import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useTelemetry } from '@comfyorg/telemetry'
import {
  autoTopUpEnabledFact,
  canManageAutoTopUpFact
} from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

import TopUpAutoTopUpLink from './TopUpAutoTopUpLink.vue'

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock<unknown>(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path: string, correlationId?: string) =>
    `https://platform.test${path}?correlation_id=${correlationId}`
}))

function renderLink({ enabled, owner }: { enabled: boolean; owner: boolean }) {
  useBillingCapabilities().autoTopUpEnabled = autoTopUpEnabledFact(enabled)
  useBillingCapabilities().canManageAutoTopUp = canManageAutoTopUpFact(owner)
  render(TopUpAutoTopUpLink, {
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

describe('TopUpAutoTopUpLink', () => {
  it('links an owner with auto top-up served to the billing site', () => {
    renderLink({ enabled: true, owner: true })

    expect(
      screen.getByRole('link', { name: 'Auto top-up settings' })
    ).toHaveAttribute(
      'href',
      expect.stringContaining('https://platform.test/profile/billing')
    )
  })

  it.for([
    { name: 'auto top-up is not served', enabled: false, owner: true },
    { name: 'the viewer cannot manage it', enabled: true, owner: false }
  ])('shows nothing when $name', ({ enabled, owner }) => {
    renderLink({ enabled, owner })

    expect(
      screen.queryByRole('link', { name: 'Auto top-up settings' })
    ).toBeNull()
  })

  it('reports the hand-off to the billing site', async () => {
    const trackBillingEvent = vi.fn()
    vi.mocked(useTelemetry).mockReturnValue({ trackBillingEvent } as never)
    renderLink({ enabled: true, owner: true })

    await userEvent.click(
      screen.getByRole('link', { name: 'Auto top-up settings' })
    )

    expect(trackBillingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'platform_handoff',
        target: 'auto_top_up',
        action: 'manage'
      })
    )
  })
})
