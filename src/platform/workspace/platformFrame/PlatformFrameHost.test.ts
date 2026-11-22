import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useFeatureFlags } from '@/composables/useFeatureFlags'

import PlatformFrameHost from './PlatformFrameHost.vue'
import {
  PLATFORM_FRAME_SANDBOX,
  PLATFORM_FRAME_UNANSWERED_MS,
  usePlatformFrameStore
} from './platformFrameStore'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))
vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@comfyorg/telemetry/reportError'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderHost() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(PlatformFrameHost, { global: { plugins: [i18n] } })
  return user
}

beforeEach(() => {
  vi.useFakeTimers()
  Object.assign(useFeatureFlags().flags, {
    customDeploymentsEditorEnabled: true
  })
})

afterEach(() => {
  usePlatformFrameStore().close()
  vi.useRealTimers()
})

describe('PlatformFrameHost', () => {
  it('shows nothing until a way in opens Platform', () => {
    renderHost()

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('frames the Platform page in a sandbox', async () => {
    renderHost()
    usePlatformFrameStore().open({ step: 'new', startAtNodes: true })
    await nextTick()

    const frame = screen.getByTestId('platform-frame')
    expect(frame).toHaveAttribute('sandbox', PLATFORM_FRAME_SANDBOX)
    expect(frame.getAttribute('src')).toMatch(
      /^https:\/\/platform\.comfy\.org\/embed\/custom-deployment\?step=new&start=nodes&/
    )
    expect(screen.getByTestId('platform-frame-unanswered')).not.toBeVisible()
  })

  it('offers Open on Platform when the page does not answer within 10 s', async () => {
    renderHost()
    usePlatformFrameStore().open({ step: 'new' })
    await nextTick()

    await vi.advanceTimersByTimeAsync(PLATFORM_FRAME_UNANSWERED_MS)
    await nextTick()

    expect(screen.getByTestId('platform-frame-unanswered')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Open on Platform' })
    ).toHaveAttribute('target', '_blank')
  })

  it.for([
    { way: 'the close button', close: 'button' },
    { way: 'Escape', close: 'escape' }
  ])('closes on $way', async ({ close }) => {
    const user = renderHost()
    usePlatformFrameStore().open({ step: 'new' })
    await nextTick()

    if (close === 'button')
      await user.click(screen.getByRole('button', { name: 'Close' }))
    else await user.keyboard('{Escape}')
    await nextTick()

    expect(usePlatformFrameStore().session).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
