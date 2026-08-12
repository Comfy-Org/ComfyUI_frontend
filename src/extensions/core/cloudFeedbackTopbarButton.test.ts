import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ActionBarButton } from '@/types/comfy'

const tabBarLayout = vi.hoisted(() => ({ value: 'Default' }))
const registerExtension = vi.hoisted(() => vi.fn())
const openFeedbackDialog = vi.hoisted(() => vi.fn())

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

vi.mock('@/platform/support/feedbackDialog', () => ({
  openFeedbackDialog
}))

describe('cloudFeedbackTopbarButton', () => {
  beforeEach(() => {
    vi.resetModules()
    registerExtension.mockReset()
    openFeedbackDialog.mockReset()
  })

  function getRegisteredButtons(): ActionBarButton[] {
    expect(registerExtension).toHaveBeenCalledTimes(1)
    const extension = registerExtension.mock.calls[0]?.[0] as {
      actionBarButtons: ActionBarButton[]
    }
    return extension.actionBarButtons
  }

  it('opens the feedback survey tagged with the action-bar source', async () => {
    tabBarLayout.value = 'Legacy'
    await import('./cloudFeedbackTopbarButton')

    const buttons = getRegisteredButtons()
    expect(buttons).toHaveLength(1)
    buttons[0].onClick?.()

    expect(openFeedbackDialog).toHaveBeenCalledWith('action-bar')
  })

  it('only registers the action bar button when the tab bar is Legacy', async () => {
    tabBarLayout.value = 'Default'
    await import('./cloudFeedbackTopbarButton')

    expect(getRegisteredButtons()).toEqual([])
  })
})
