import fs from 'fs'
import { CORE_SETTINGS } from '../src/constants/coreSettings'
import { CORE_MENU_COMMANDS } from '../src/constants/coreMenuCommands'

interface SettingLocale {
  name: string
  tooltip?: string
}

const extractSettingLocaleStrings = (): Record<string, SettingLocale> => {
  return Object.fromEntries(
    CORE_SETTINGS.sort((a, b) => a.id.localeCompare(b.id)).map((setting) => [
      // '.' is not allowed in JSON keys, so we replace it with '_'
      setting.id.replace(/\./g, '_'),
      {
        name: setting.name,
        tooltip: setting.tooltip
      }
    ])
  )
}

const extractMenuCommandLocaleStrings = (): Record<string, string> => {
  const labels = new Set<string>()
  for (const [category, _] of CORE_MENU_COMMANDS) {
    category.forEach((category) => labels.add(category))
  }
  return Object.fromEntries(Array.from(labels).map((label) => [label, label]))
}

const main = () => {
  const settingLocaleStrings = extractSettingLocaleStrings()
  const menuCommandLocaleStrings = extractMenuCommandLocaleStrings()

  const localePath = './src/locales/en.json'
  const globalLocale = JSON.parse(fs.readFileSync(localePath, 'utf-8'))
  fs.writeFileSync(
    localePath,
    JSON.stringify(
      {
        ...globalLocale,
        settingsDialog: {
          ...(globalLocale.settingsDialog ?? {}),
          ...settingLocaleStrings
        },
        menuLabels: {
          ...(globalLocale.menuLabels ?? {}),
          ...menuCommandLocaleStrings
        }
      },
      null,
      2
    )
  )
}

main()
