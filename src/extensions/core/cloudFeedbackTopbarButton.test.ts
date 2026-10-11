import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { openFeedbackDialog } from '@/platform/support/feedbackDialog'
import type { ActionBarButton } from '@/types/comfy'
import type { useExtensionService } from '@/services/extensionService'

const registerExtension = vi.hoisted(() => vi.fn())

vi.mock(import('@/i18n'))

vi.mock(import('@/services/extensionService'), () => ({
  useExtensionService: () =>
    fromPartial<ReturnType<typeof useExtensionService>>({ registerExtension })
}))

vi.mock(import('@/platform/support/feedbackDialog'), () => ({
  openFeedbackDialog: vi.fn()
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
    buttons[0].onClick()

    expect(openFeedbackDialog).toHaveBeenCalledWith('action-bar')
  })

  it('only registers the action bar button when the tab bar is Legacy', async () => {
    vi.mocked(useSettingStore().get).mockReturnValue('Default')
    await import('./cloudFeedbackTopbarButton')

    expect(getRegisteredButtons()).toEqual([])
  })
})
