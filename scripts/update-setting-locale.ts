import fs from 'fs'
import { CORE_SETTINGS } from '../src/constants/coreSettings'

interface SettingLocale {
  name: string
  tooltip?: string
}

const extractLocaleStrings = (): Record<string, SettingLocale> => {
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

const main = () => {
  const localeStrings = extractLocaleStrings()
  const localePath = './src/locales/en.json'
  const globalLocale = JSON.parse(fs.readFileSync(localePath, 'utf-8'))
  fs.writeFileSync(
    localePath,
    JSON.stringify({ ...globalLocale, settingsDialog: localeStrings }, null, 2)
  )
}

main()
