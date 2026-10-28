import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { i18n } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'
import { openFeedbackDialog } from '@/platform/support/feedbackDialog'

import { feedbackButtonExtension } from './cloudFeedbackTopbarButton'

vi.mock(import('@/platform/support/feedbackDialog'), () => ({
  openFeedbackDialog: vi.fn()
}))

describe('cloudFeedbackTopbarButton', () => {
  it('opens the feedback survey tagged with the action-bar source', () => {
    vi.mocked(useSettingStore().get).mockReturnValue('Legacy')

    const buttons = feedbackButtonExtension.actionBarButtons ?? []
    expect(buttons).toHaveLength(1)
    expect(buttons[0].icon).toBe('icon-[lucide--megaphone] size-4')
    buttons[0].onClick()

    expect(openFeedbackDialog).toHaveBeenCalledWith('action-bar')
  })

  it('labels the button in the locale active when the action bar reads it', () => {
    vi.mocked(useSettingStore().get).mockReturnValue('Legacy')
    const initialLocale = i18n.global.locale.value
    onTestFinished(() => {
      i18n.global.locale.value = initialLocale
    })
    i18n.global.mergeLocaleMessage('fr', {
      actionbar: { feedback: 'Avis', feedbackTooltip: 'Donner votre avis' }
    })

    expect(feedbackButtonExtension.actionBarButtons?.[0]).toMatchObject({
      label: 'Feedback',
      tooltip: 'Feedback'
    })
    i18n.global.locale.value = 'fr'
    expect(feedbackButtonExtension.actionBarButtons?.[0]).toMatchObject({
      label: 'Avis',
      tooltip: 'Donner votre avis'
    })
  })

  it('only shows the action bar button when the tab bar is Legacy', () => {
    vi.mocked(useSettingStore().get).mockReturnValue('Default')

    expect(feedbackButtonExtension.actionBarButtons).toEqual([])
  })
})
