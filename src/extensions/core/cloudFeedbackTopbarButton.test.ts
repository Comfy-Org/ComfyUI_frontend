import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import type { ActionBarButton } from '@/types/comfy'

const registerExtension = vi.hoisted(() => vi.fn())
const openFeedbackDialog = vi.hoisted(() => vi.fn())

vi.mock('@/i18n', () => ({
  t: (key: string) => key
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
  })

  function getRegisteredButtons(): ActionBarButton[] {
    expect(registerExtension).toHaveBeenCalledTimes(1)
    const extension = registerExtension.mock.calls[0]?.[0] as {
      actionBarButtons: ActionBarButton[]
    }
    return extension.actionBarButtons
  }

  it('opens the feedback survey tagged with the action-bar source', async () => {
    vi.mocked(useSettingStore().get).mockReturnValue('Legacy')
    await import('./cloudFeedbackTopbarButton')

    const buttons = getRegisteredButtons()
    expect(buttons).toHaveLength(1)
    expect(buttons[0].icon).toBe('icon-[hugeicons--megaphone-03]')
    buttons[0].onClick?.()

    expect(openFeedbackDialog).toHaveBeenCalledWith('action-bar')
  })

  it('only registers the action bar button when the tab bar is Legacy', async () => {
    vi.mocked(useSettingStore().get).mockReturnValue('Default')
    await import('./cloudFeedbackTopbarButton')

    expect(getRegisteredButtons()).toEqual([])
  })
})
