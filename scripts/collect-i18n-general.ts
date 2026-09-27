import * as fs from 'fs'

// Import Vite define shim to make __DISTRIBUTION__ and other define variables available
import './vite-define-shim'

import { comfyPageFixture as test } from '../browser_tests/fixtures/ComfyPage'
import {
  formatCamelCase,
  normalizeI18nKey
} from '@comfyorg/shared-frontend-utils/formatUtil'
import { CORE_MENU_COMMANDS } from '../src/constants/coreMenuCommands'
import { SERVER_CONFIG_ITEMS } from '../src/constants/serverConfig'

const localePath = './src/locales/en/main.json'
const commandsPath = './src/locales/en/commands.json'
const settingsPath = './src/locales/en/settings.json'

function getSettingOptionLabels(options: unknown): string[] | undefined {
  if (!Array.isArray(options)) return undefined

  return options.flatMap((option: unknown) => {
    if (typeof option === 'string') return option
    if (
      typeof option === 'object' &&
      option !== null &&
      'text' in option &&
      typeof option.text === 'string'
    ) {
      return option.text
    }
    return []
  })
}

const extractMenuCommandLocaleStrings = (): Set<string> => {
  const labels = new Set<string>()
  for (const [category, _] of CORE_MENU_COMMANDS) {
    category.forEach((category) => labels.add(category))
  }
  return labels
}

test('collect-i18n-general', async ({ comfyPage }) => {
  const commands = (
    await comfyPage.page.evaluate(() => {
      const app = window.app
      if (!app) throw new Error('ComfyUI app is not initialized')

      return app.extensionManager.command.commands.map((command) => {
        const label =
          typeof command.label === 'function' ? command.label() : command.label
        const menubarLabel =
          typeof command.menubarLabel === 'function'
            ? command.menubarLabel()
            : command.menubarLabel
        const tooltip =
          typeof command.tooltip === 'function'
            ? command.tooltip()
            : command.tooltip

        return { id: command.id, label, menubarLabel, tooltip }
      })
    })
  ).sort((a, b) => a.id.localeCompare(b.id))

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

  const allCommandsLocale = Object.fromEntries(
    commands.map((command) => [
      normalizeI18nKey(command.id),
      {
        label: command.label,
        tooltip: command.tooltip
      }
    ])
  )

  // Settings
  const settings = await comfyPage.page.evaluate(async () => {
    const { useSettingStore } =
      await import('../src/platform/settings/settingStore')
    return Object.values(useSettingStore().settingsById)
      .sort((a, b) => a.id.localeCompare(b.id))
      .filter((setting) => setting.type !== 'hidden')
      .map((setting) => {
        const options: unknown = Reflect.get(setting, 'options')
        const defaultValue =
          typeof setting.defaultValue === 'function'
            ? setting.defaultValue()
            : setting.defaultValue
        const resolvedOptions: unknown =
          typeof options === 'function'
            ? Reflect.apply(options, undefined, [defaultValue ?? ''])
            : options

        return {
          id: setting.id,
          name: setting.name,
          tooltip: setting.tooltip,
          category: setting.category,
          options: resolvedOptions
        }
      })
  })

  const allSettingsLocale = Object.fromEntries(
    settings.map((setting) => {
      const optionLabels = getSettingOptionLabels(setting.options)
      return [
        normalizeI18nKey(setting.id),
        {
          name: setting.name,
          tooltip: setting.tooltip,
          // Don't translate the locale options as each option is in its own language.
          // e.g. "English", "中文", "Русский", "日本語", "한국어"
          options:
            optionLabels && setting.id !== 'Comfy.Locale'
              ? Object.fromEntries(
                  optionLabels.map((label) => [normalizeI18nKey(label), label])
                )
              : undefined
        }
      ]
    })
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
        name: config.name,
        tooltip: config.tooltip
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

  fs.writeFileSync(
    localePath,
    JSON.stringify(
      {
        ...locale,
        menuLabels: allLabelsLocale,
        // Do merge for settingsCategories as there are some manual translations
        // for special panels like "About" and "Keybinding".
        settingsCategories: {
          ...(locale.settingsCategories ?? {}),
          ...allSettingCategoriesLocale
        },
        serverConfigItems: allServerConfigsLocale,
        serverConfigCategories: allServerConfigCategoriesLocale
      },
      null,
      2
    )
  )

  fs.writeFileSync(commandsPath, JSON.stringify(allCommandsLocale, null, 2))
  fs.writeFileSync(settingsPath, JSON.stringify(allSettingsLocale, null, 2))
})
