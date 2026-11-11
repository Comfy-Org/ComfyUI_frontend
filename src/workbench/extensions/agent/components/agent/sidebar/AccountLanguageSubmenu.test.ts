import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SUPPORTED_LOCALE_OPTIONS } from '@/locales/localeConfig'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@comfyorg/telemetry'
import { reportError } from '@comfyorg/telemetry/reportError'

import AccountLanguageSubmenu from './AccountLanguageSubmenu.vue'
import { renderInOpenMenu } from './accountSubmenuTestSetup'

vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@comfyorg/telemetry/reportError'))

async function openLanguages(): Promise<HTMLElement[]> {
  await renderInOpenMenu(AccountLanguageSubmenu)
  await userEvent.click(screen.getByRole('menuitem', { name: 'Language' }))
  return screen.findAllByRole('menuitemradio')
}

describe('AccountLanguageSubmenu', () => {
  beforeEach(() => {
    const settingStore = useSettingStore()
    settingStore.settingValues['Comfy.Locale'] = 'fr'
    vi.mocked(settingStore.set).mockResolvedValue()
  })

  it('lists every supported language and checks the current one', async () => {
    const languages = await openLanguages()

    expect(languages).toHaveLength(SUPPORTED_LOCALE_OPTIONS.length)
    expect(
      screen.getByRole('menuitemradio', { name: 'Français' })
    ).toBeChecked()
    expect(
      screen.getByRole('menuitemradio', { name: 'English' })
    ).not.toBeChecked()
  })

  it.for([
    { name: 'English', lang: 'en' },
    { name: '繁體中文', lang: 'zh-TW' },
    { name: 'Português (BR)', lang: 'pt-BR' }
  ])('marks "$name" as written in $lang', async ({ name, lang }) => {
    await openLanguages()

    expect(screen.getByRole('menuitemradio', { name })).toHaveAttribute(
      'lang',
      lang
    )
  })

  it('saves the chosen language and records the change', async () => {
    await openLanguages()

    await userEvent.click(screen.getByRole('menuitemradio', { name: '日本語' }))

    expect(useSettingStore().set).toHaveBeenCalledExactlyOnceWith(
      'Comfy.Locale',
      'ja'
    )
    expect(useTelemetry()?.trackUiButtonClicked).toHaveBeenCalledWith({
      button_id: 'agent_account_menu_language_changed',
      element_group: 'agent_account_menu'
    })
  })

  it('leaves the setting alone when the current language is chosen again', async () => {
    await openLanguages()

    await userEvent.click(
      screen.getByRole('menuitemradio', { name: 'Français' })
    )

    expect(useSettingStore().set).not.toHaveBeenCalled()
    expect(useTelemetry()?.trackUiButtonClicked).not.toHaveBeenCalled()
  })

  it('reports a language that could not be saved', async () => {
    const failure = new Error('settings unavailable')
    vi.mocked(useSettingStore().set).mockRejectedValue(failure)
    await openLanguages()

    await userEvent.click(screen.getByRole('menuitemradio', { name: '日本語' }))

    await vi.waitFor(() => {
      expect(reportError).toHaveBeenCalledWith(failure, {
        surface: 'agent',
        errorType: 'error_saving_agent_account_language'
      })
    })
  })
})
