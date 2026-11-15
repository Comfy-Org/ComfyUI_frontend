import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useTelemetry } from '@comfyorg/telemetry'
import { registerRefreshOnReturn } from '@/platform/billing/refreshOnReturn'

import PlatformPlansLinkDialog from './PlatformPlansLinkDialog.vue'

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/billing/refreshOnReturn'), { spy: true })

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { close: 'Close' } } }
})

function renderDialog(onClose = vi.fn()) {
  render(PlatformPlansLinkDialog, {
    props: {
      title: "Plans page didn't open",
      body: 'Your browser blocked the new tab.',
      linkLabel: 'Open Plans page',
      onClose
    },
    global: { plugins: [i18n] }
  })
  return onClose
}

describe('PlatformPlansLinkDialog', () => {
  it('links to the Plans page in a new tab so it opens with pop-ups blocked', () => {
    renderDialog()

    const link = screen.getByRole('link', { name: 'Open Plans page' })
    expect(new URL(link.getAttribute('href') ?? '').pathname).toBe(
      '/profile/billing/plans'
    )
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('reports the hand-off with the journey id the link carries and closes when followed', async () => {
    const onClose = renderDialog()
    const link = screen.getByRole('link', { name: 'Open Plans page' })
    link.addEventListener('click', (event) => event.preventDefault())

    await userEvent.click(link)

    expect(useTelemetry()?.trackBillingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'platform_handoff',
        target: 'plans',
        correlation_id: new URL(
          link.getAttribute('href') ?? ''
        ).searchParams.get('correlation_id')
      })
    )
    expect(registerRefreshOnReturn).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })
})
