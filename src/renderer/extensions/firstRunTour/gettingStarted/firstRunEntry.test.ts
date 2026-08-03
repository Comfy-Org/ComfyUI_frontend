import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  isCloud: true,
  breakpoint: { value: true },
  isNewUser: true as boolean | null,
  tourFlag: true,
  execute: vi.fn(),
  setSetting: vi.fn(() => Promise.resolve())
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mocks.isCloud
  }
}))
vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useBreakpoints: () => ({ greaterOrEqual: () => mocks.breakpoint })
}))
vi.mock('@/services/useNewUserService', () => ({
  useNewUserService: () => ({ isNewUser: () => mocks.isNewUser })
}))
vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    flags: {
      get onboardingTourEnabled() {
        return mocks.tourFlag
      }
    }
  })
}))
vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({ execute: mocks.execute })
}))
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ set: mocks.setSetting })
}))

async function freshEntry() {
  const { useFirstRunEntry } = await import('./firstRunEntry')
  return useFirstRunEntry()
}

describe('useFirstRunEntry', () => {
  beforeEach(() => {
    vi.resetModules()
    setActivePinia(createPinia())
    mocks.isCloud = true
    mocks.breakpoint.value = true
    mocks.isNewUser = true
    mocks.tourFlag = true
    mocks.execute.mockClear()
    mocks.setSetting.mockClear()
  })

  it('shows the takeover to a fresh candidate without touching settings', async () => {
    const entry = await freshEntry()
    await entry.handleStartupOutcome('fresh')
    expect(entry.gettingStartedVisible.value).toBe(true)
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(mocks.setSetting).not.toHaveBeenCalled()
  })

  it.for([
    ['not cloud', (): void => void (mocks.isCloud = false)],
    ['unknown user', (): void => void (mocks.isNewUser = null)],
    ['flag off', (): void => void (mocks.tourFlag = false)]
  ] as const)(
    'falls back to the template browser when %s',
    async ([, disqualify]) => {
      disqualify()
      const entry = await freshEntry()
      await entry.handleStartupOutcome('fresh')
      expect(entry.gettingStartedVisible.value).toBe(false)
      expect(mocks.execute).toHaveBeenCalledWith('Comfy.BrowseTemplates')
      expect(mocks.setSetting).toHaveBeenCalledWith(
        'Comfy.TutorialCompleted',
        true
      )
    }
  )

  it('leaves a restored startup alone', async () => {
    const entry = await freshEntry()
    await entry.handleStartupOutcome('restored')
    expect(entry.gettingStartedVisible.value).toBe(false)
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(mocks.setSetting).not.toHaveBeenCalled()
  })

  it('marks a url-intent arrival done without opening anything', async () => {
    const entry = await freshEntry()
    await entry.handleStartupOutcome('url-intent')
    expect(entry.gettingStartedVisible.value).toBe(false)
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(mocks.setSetting).toHaveBeenCalledWith(
      'Comfy.TutorialCompleted',
      true
    )
  })

  it('writes TutorialCompleted only on dismissal', async () => {
    const entry = await freshEntry()
    await entry.handleStartupOutcome('fresh')
    await entry.dismissGettingStarted()
    expect(entry.gettingStartedVisible.value).toBe(false)
    expect(mocks.setSetting).toHaveBeenCalledExactlyOnceWith(
      'Comfy.TutorialCompleted',
      true
    )
  })
})
