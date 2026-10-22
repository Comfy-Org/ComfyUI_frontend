import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { openFeedbackDialog } from '@/platform/support/feedbackDialog'
import type { ActionBarButton } from '@/types/comfy'
import type { useExtensionService } from '@/services/extensionService'

const registerExtension = vi.hoisted(() => vi.fn())

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
    expect(buttons[0].icon).toBe('icon-[lucide--megaphone] size-4')
    buttons[0].onClick()

    expect(openFeedbackDialog).toHaveBeenCalledWith('action-bar')
  })

  it('labels the button in the locale active when the action bar reads it', async () => {
    vi.mocked(useSettingStore().get).mockReturnValue('Legacy')
    await import('./cloudFeedbackTopbarButton')
    const { i18n } = await import('@/i18n')
    i18n.global.mergeLocaleMessage('fr', {
      actionbar: { feedback: 'Avis', feedbackTooltip: 'Donner votre avis' }
    })

    expect(getRegisteredButtons()[0]).toMatchObject({
      label: 'Feedback',
      tooltip: 'Feedback'
    })
    i18n.global.locale.value = 'fr'
    expect(getRegisteredButtons()[0]).toMatchObject({
      label: 'Avis',
      tooltip: 'Donner votre avis'
    })
  })

  it('only registers the action bar button when the tab bar is Legacy', async () => {
    vi.mocked(useSettingStore().get).mockReturnValue('Default')
    await import('./cloudFeedbackTopbarButton')

    expect(getRegisteredButtons()).toEqual([])
  })
})
