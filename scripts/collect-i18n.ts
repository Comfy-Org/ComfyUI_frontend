import * as fs from 'fs'
import { comfyPageFixture as test } from '../browser_tests/fixtures/ComfyPage'
import type { ComfyCommand } from '../src/stores/commandStore'
import { CORE_MENU_COMMANDS } from '../src/constants/coreMenuCommands'

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
    const commands = workspace.command.commands as ComfyCommand[]
    return commands.map((command) => ({
      id: command.id,
      label: command.label,
      menubarLabel: command.menubarLabel
    }))
  })

  const locale = JSON.parse(fs.readFileSync(localePath, 'utf-8'))
  const menuLabels = extractMenuCommandLocaleStrings()
  const commandMenuLabels = new Set(
    commands.map((command) => command.menubarLabel ?? command.label)
  )
  const allLabels = new Set([...menuLabels, ...commandMenuLabels])
  const allLabelsLocale = Object.fromEntries(
    Array.from(allLabels).map((label) => [label, label])
  )

  fs.writeFileSync(
    localePath,
    JSON.stringify(
      {
        ...locale,
        menuLabels: allLabelsLocale
      },
      null,
      2
    )
  )
})
