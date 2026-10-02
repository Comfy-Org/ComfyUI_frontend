import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'

import {
  consentOfferDeclined,
  recordConsentOfferDeclined
} from './consentOfferDeclined'

// Explicit rather than automocked: `getSettings` and `storeSetting` live on the
// `ComfyApi` prototype, which the automock leaves alone.
vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: { getSettings: vi.fn(), storeSetting: vi.fn() }
}))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/telemetry'))

const SETTING_ID = 'Comfy.AgentPanel.ConsentOfferDeclined'

describe('consentOfferDeclined', () => {
  beforeEach(() => {
    vi.mocked(api.getSettings).mockReset()
    vi.mocked(api.storeSetting).mockReset()
    vi.mocked(api.storeSetting).mockResolvedValue(new Response())
  })

  it('reads the refusal the account carries, not this device', async () => {
    // The store's values come from `/api/settings`, which on cloud is stored on
    // the user row - so this read is what makes the suppression follow the
    // account to another browser profile or device. PM-1910's reporter refused
    // three times on three devices because the only record was local.
    vi.mocked(api.getSettings).mockResolvedValue({
      [SETTING_ID]: true
    } as never)

    expect(await consentOfferDeclined()).toBe(true)
    expect(api.getSettings).toHaveBeenCalledOnce()
  })

  it('answers false for an account that has never refused', async () => {
    vi.mocked(api.getSettings).mockResolvedValue({} as never)

    expect(await consentOfferDeclined()).toBe(false)
  })

  it('waits for the settings load rather than reading an empty store', async () => {
    // The automatic offer can settle on a cached consent read, so a read that
    // answered from an unloaded store would offer the card to the user who
    // already refused it - the exact defect, reintroduced one layer up.
    let settle = (_: Record<string, unknown>) => {}
    vi.mocked(api.getSettings).mockReturnValue(
      new Promise((resolve) => {
        settle = resolve
      }) as never
    )
    const declined = consentOfferDeclined()
    settle({ [SETTING_ID]: true })
    expect(await declined).toBe(true)
  })

  it('does not claim a refusal it could not read', async () => {
    // Fail-open, because the loader is boot-critical: a session that reaches the
    // agent has already loaded settings, so the surviving failure shape is a
    // store that never loaded - where no refusal could have been stored either.
    //
    // The loader is stubbed rather than driven through a failing request: a real
    // failure retries with exponential backoff, which would make this a
    // seven-second unit test measuring vueuse rather than this module.
    vi.spyOn(useSettingStore(), 'load').mockRejectedValue(new Error('offline'))

    expect(await consentOfferDeclined()).toBe(false)
  })

  it('persists the refusal through the account-scoped settings domain', async () => {
    vi.mocked(api.getSettings).mockResolvedValue({} as never)
    await useSettingStore().load()

    await recordConsentOfferDeclined()

    expect(api.storeSetting).toHaveBeenCalledExactlyOnceWith(SETTING_ID, true)
    expect(await consentOfferDeclined()).toBe(true)
  })

  it('raises a failed write so the caller can report it', async () => {
    vi.mocked(api.getSettings).mockResolvedValue({} as never)
    await useSettingStore().load()
    vi.mocked(api.storeSetting).mockRejectedValue(new Error('offline'))

    await expect(recordConsentOfferDeclined()).rejects.toThrow('offline')
  })

  it('raises an unsuccessful response and leaves the refusal retryable', async () => {
    vi.mocked(api.getSettings).mockResolvedValue({} as never)
    await useSettingStore().load()
    vi.mocked(api.storeSetting).mockResolvedValue(
      new Response(null, { status: 500 })
    )

    await expect(recordConsentOfferDeclined()).rejects.toThrow('(500)')
    expect(useSettingStore().settingValues[SETTING_ID as never]).toBeUndefined()

    vi.mocked(api.storeSetting).mockResolvedValue(new Response())
    await recordConsentOfferDeclined()
    expect(api.storeSetting).toHaveBeenCalledTimes(2)
  })
})
