import * as fs from 'fs'
import { comfyPageFixture as test } from '../browser_tests/fixtures/ComfyPage'
import { CORE_MENU_COMMANDS } from '../src/constants/coreMenuCommands'
import { SERVER_CONFIG_ITEMS } from '../src/constants/serverConfig'
import { formatCamelCase, normalizeI18nKey } from '../src/utils/formatUtil'
import { ComfyNodeDefImpl } from '../src/stores/nodeDefStore'
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
        category: setting.category,
        options: setting.options
      }))
  })

  const allSettingsLocale = Object.fromEntries(
    settings.map((setting) => [
      normalizeI18nKey(setting.id),
      {
        name: setting.name,
        tooltip: setting.tooltip,
        // Don't translate the locale options as each option is in its own language.
        // e.g. "English", "中文", "Русский", "日本語", "한국어"
        options:
          setting.options && setting.id !== 'Comfy.Locale'
            ? Object.fromEntries(
                setting.options.map((option) => {
                  const optionLabel =
                    typeof option === 'string' ? option : option.text
                  return [normalizeI18nKey(optionLabel), optionLabel]
                })
              )
            : undefined
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
  const nodeDefs: ComfyNodeDefImpl[] = Object.values(
    await comfyPage.page.evaluate(async () => {
      const api = window['app'].api as ComfyApi
      return await api.getNodeDefs()
    })
  ).map((def) => new ComfyNodeDefImpl(def))

  console.log(`Collected ${nodeDefs.length} node definitions`)

  const allDataTypesLocale = Object.fromEntries(
    nodeDefs
      .flatMap((nodeDef) => {
        const inputDataTypes = Object.values(nodeDef.inputs.all).map(
          (inputSpec) => inputSpec.type
        )
        const outputDataTypes = nodeDef.outputs.all.map((output) => output.type)
        const allDataTypes = [...inputDataTypes, ...outputDataTypes].flatMap(
          (type: string) => type.split(',')
        )
        return allDataTypes.map((dataType) => [
          normalizeI18nKey(dataType),
          dataType
        ])
      })
      .sort((a, b) => a[0].localeCompare(b[0]))
  )

  function extractInputs(nodeDef: ComfyNodeDefImpl) {
    const inputs = Object.fromEntries(
      nodeDef.inputs.all.flatMap((input) => {
        // TODO(huchenlei): translate input name. Somehow `CLIPAttentionMultiply` will
        // cause all subsequent translations to fail (Raw english values
        // are generated).
        const name = undefined
        const tooltip = input.tooltip

        if (name === undefined && tooltip === undefined) {
          return []
        }

        return [
          [
            normalizeI18nKey(input.name),
            {
              name,
              tooltip
            }
          ]
        ]
      })
    )
    return Object.keys(inputs).length > 0 ? inputs : undefined
  }

  function extractOutputs(nodeDef: ComfyNodeDefImpl) {
    const outputs = Object.fromEntries(
      nodeDef.outputs.all.flatMap((output, i) => {
        // Ignore data types if they are already translated in allDataTypesLocale.
        const name = output.name in allDataTypesLocale ? undefined : output.name
        const tooltip = output.tooltip

        if (name === undefined && tooltip === undefined) {
          return []
        }

        return [
          [
            i.toString(),
            {
              name,
              tooltip
            }
          ]
        ]
      })
    )
    return Object.keys(outputs).length > 0 ? outputs : undefined
  }

  const allNodeDefsLocale = Object.fromEntries(
    nodeDefs
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((nodeDef) => [
        normalizeI18nKey(nodeDef.name),
        {
          display_name: nodeDef.display_name ?? nodeDef.name,
          description: nodeDef.description || undefined,
          inputs: extractInputs(nodeDef),
          outputs: extractOutputs(nodeDef)
        }
      ])
  )

  const allNodeCategoriesLocale = Object.fromEntries(
    nodeDefs.flatMap((nodeDef) =>
      nodeDef.category
        .split('/')
        .map((category) => [normalizeI18nKey(category), category])
    )
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
        nodeDefs: allNodeDefsLocale,
        dataTypes: allDataTypesLocale,
        nodeCategories: allNodeCategoriesLocale
      },
      null,
      2
    )
  )
})
