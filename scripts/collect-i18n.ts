import * as fs from 'fs'
import { comfyPageFixture as test } from '../browser_tests/fixtures/ComfyPage'
import { CORE_MENU_COMMANDS } from '../src/constants/coreMenuCommands'
import { SERVER_CONFIG_ITEMS } from '../src/constants/serverConfig'
import { formatCamelCase, normalizeI18nKey } from '../src/utils/formatUtil'
import type { ComfyCommandImpl } from '../src/stores/commandStore'
import type { FormItem, SettingParams } from '../src/types/settingTypes'
import type { ComfyApi } from '../src/scripts/api'

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

  // Commands
  const menuLabels = extractMenuCommandLocaleStrings()
  const commandMenuLabels = new Set(
    commands.map((command) => command.menubarLabel ?? command.label ?? '')
  )
  const allLabels = new Set([...menuLabels, ...commandMenuLabels])
  allLabels.delete('')

  const allLabelsLocale = Object.fromEntries(
    Array.from(allLabels).map((label) => [normalizeI18nKey(label), label])
  )

  // Settings
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

  // Server Configs
  const allServerConfigsLocale = Object.fromEntries(
    SERVER_CONFIG_ITEMS.map((config) => [
      normalizeI18nKey(config.id),
      {
        name: (config as unknown as FormItem).name,
        tooltip: (config as unknown as FormItem).tooltip
      }
    ])
  )

  const allServerConfigCategoriesLocale = Object.fromEntries(
    SERVER_CONFIG_ITEMS.flatMap((config) => {
      return config.category ?? ['General']
    }).map((category) => [
      normalizeI18nKey(category),
      formatCamelCase(category)
    ])
  )

  // Node Definitions
  const nodeDefs = await comfyPage.page.evaluate(async () => {
    const api = window['app'].api as ComfyApi
    return await api.getNodeDefs()
  })

  const allNodeDefsLocale = Object.fromEntries(
    Object.values(nodeDefs)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((nodeDef) => [
        normalizeI18nKey(nodeDef.name),
        {
          display_name: nodeDef.display_name ?? nodeDef.name,
          description: nodeDef.description || undefined
        }
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
        },
        serverConfigItems: allServerConfigsLocale,
        serverConfigCategories: allServerConfigCategoriesLocale,
        nodeDefs: allNodeDefsLocale
      },
      null,
      2
    )
  )
})
