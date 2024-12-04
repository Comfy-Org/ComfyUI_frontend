import * as fs from 'fs'
import { comfyPageFixture as test } from '../browser_tests/fixtures/ComfyPage'
import { CORE_MENU_COMMANDS } from '../src/constants/coreMenuCommands'
import { formatCamelCase, normalizeI18nKey } from '../src/utils/formatUtil'
import type { ComfyCommandImpl } from '../src/stores/commandStore'
import type { SettingParams } from '../src/types/settingTypes'

const localePath = './src/locales/en.json'
const extractMenuCommandLocaleStrings = (): Set<string> => {
  const labels = new Set<string>()
  for (const [category, _] of CORE_MENU_COMMANDS) {
    category.forEach((category) => labels.add(category))
  }
  return labels
}

test('collect-i18n', async ({ comfyPage }) => {
  const commands = await comfyPage.page.evaluate(() => {
    const workspace = window['app'].extensionManager
    const commands = workspace.command.commands as ComfyCommandImpl[]
    return commands.map((command) => ({
      id: command.id,
      label: command.label,
      menubarLabel: command.menubarLabel
    }))
  })

  const locale = JSON.parse(fs.readFileSync(localePath, 'utf-8'))
  const menuLabels = extractMenuCommandLocaleStrings()
  const commandMenuLabels = new Set(
    commands.map((command) => command.menubarLabel ?? command.label ?? '')
  )
  const allLabels = new Set([...menuLabels, ...commandMenuLabels])
  allLabels.delete('')

  const allLabelsLocale = Object.fromEntries(
    Array.from(allLabels).map((label) => [normalizeI18nKey(label), label])
  )

  const settings = await comfyPage.page.evaluate(() => {
    const workspace = window['app'].extensionManager
    const settings = workspace.setting.settings as Record<string, SettingParams>
    return Object.values(settings)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((setting) => ({
        id: setting.id,
        name: setting.name,
        tooltip: setting.tooltip,
        category: setting.category
      }))
  })

  const allSettingsLocale = Object.fromEntries(
    settings.map((setting) => [
      normalizeI18nKey(setting.id),
      {
        name: setting.name,
        tooltip: setting.tooltip
      }
    ])
  )

  const allSettingCategoriesLocale = Object.fromEntries(
    settings
      .flatMap((setting) => {
        return (setting.category ?? setting.id.split('.')).slice(0, 2)
      })
      .map((category: string) => [
        normalizeI18nKey(category),
        formatCamelCase(category)
      ])
  )

  fs.writeFileSync(
    localePath,
    JSON.stringify(
      {
        ...locale,
        menuLabels: allLabelsLocale,
        settingsDialog: allSettingsLocale,
        // Do merge for settingsCategories as there are some manual translations
        // for special panels like "About" and "Keybinding".
        settingsCategories: {
          ...(locale.settingsCategories ?? {}),
          ...allSettingCategoriesLocale
        }
      },
      null,
      2
    )
  )
})
