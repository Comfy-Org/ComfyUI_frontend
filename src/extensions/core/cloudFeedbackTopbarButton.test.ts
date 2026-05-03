import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ActionBarButton } from '@/types/comfy'

const distribution = vi.hoisted(() => ({ isCloud: false, isNightly: false }))

const tabBarLayout = vi.hoisted(() => ({ value: 'Default' }))
const registerExtension = vi.hoisted(() => vi.fn())

vi.mock('@/i18n', () => ({
  t: (key: string) => key
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) =>
      key === 'Comfy.UI.TabBarLayout' ? tabBarLayout.value : undefined
  })
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension
  })
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return distribution.isCloud
  },
  get isNightly() {
    return distribution.isNightly
  }
}))

describe('cloudFeedbackTopbarButton', () => {
  let openSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    registerExtension.mockReset()
    distribution.isCloud = false
    distribution.isNightly = false
    openSpy = vi.spyOn(window, 'open').mockReturnValue(null)
  })

  afterEach(() => {
    openSpy.mockRestore()
  })

  function getRegisteredButtons(): ActionBarButton[] {
    expect(registerExtension).toHaveBeenCalledTimes(1)
    const extension = registerExtension.mock.calls[0]?.[0] as {
      actionBarButtons: ActionBarButton[]
    }
    return extension.actionBarButtons
  }

  it('opens the Typeform survey tagged with action-bar source on Cloud', async () => {
    tabBarLayout.value = 'Legacy'
    distribution.isCloud = true
    await import('./cloudFeedbackTopbarButton')

    const buttons = getRegisteredButtons()
    expect(buttons).toHaveLength(1)
    buttons[0].onClick?.()

    expect(openSpy).toHaveBeenCalledTimes(1)
    const [url, target, features] = openSpy.mock.calls[0]
    expect(url).toBe(
      'https://form.typeform.com/to/q7azbWPi#distribution=ccloud&source=action-bar'
    )
    expect(target).toBe('_blank')
    expect(features).toBe('noopener,noreferrer')
  })

  it('only registers the action bar button when the tab bar is Legacy', async () => {
    tabBarLayout.value = 'Default'
    await import('./cloudFeedbackTopbarButton')

    expect(getRegisteredButtons()).toEqual([])
  })
})
