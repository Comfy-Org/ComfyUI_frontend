import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FEEDBACK_TYPEFORM_URL } from '@/platform/support/config'
import type { ActionBarButton } from '@/types/comfy'

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

describe('cloudFeedbackTopbarButton', () => {
  let openSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    registerExtension.mockReset()
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

  it('opens the Typeform survey when the Legacy action bar button is clicked', async () => {
    tabBarLayout.value = 'Legacy'
    await import('./cloudFeedbackTopbarButton')

    const buttons = getRegisteredButtons()
    expect(buttons).toHaveLength(1)
    buttons[0].onClick?.()

    expect(openSpy).toHaveBeenCalledWith(
      FEEDBACK_TYPEFORM_URL,
      '_blank',
      'noopener,noreferrer'
    )
  })

  it('only registers the action bar button when the tab bar is Legacy', async () => {
    tabBarLayout.value = 'Default'
    await import('./cloudFeedbackTopbarButton')

    expect(getRegisteredButtons()).toEqual([])
  })
})
