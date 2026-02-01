import type { Page } from '@playwright/test'

import type { KeyCombo } from '../../../src/platform/keybindings'

export class CommandHelper {
  constructor(private readonly page: Page) {}

  async executeCommand(commandId: string): Promise<void> {
    await this.page.evaluate((id: string) => {
      return window.app!.extensionManager.command.execute(id)
    }, commandId)
  }

  async registerCommand(
    commandId: string,
    command: (() => void) | (() => Promise<void>)
  ): Promise<void> {
    await this.page.evaluate(
      ({ commandId, commandStr }) => {
        const app = window.app!
        const randomSuffix = Math.random().toString(36).substring(2, 8)
        const extensionName = `TestExtension_${randomSuffix}`

        app.registerExtension({
          name: extensionName,
          commands: [
            {
              id: commandId,
              function: eval(commandStr)
            }
          ]
        })
      },
      { commandId, commandStr: command.toString() }
    )
  }

  async registerKeybinding(
    keyCombo: KeyCombo,
    command: () => void
  ): Promise<void> {
    await this.page.evaluate(
      ({ keyCombo, commandStr }) => {
        const app = window.app!
        const randomSuffix = Math.random().toString(36).substring(2, 8)
        const extensionName = `TestExtension_${randomSuffix}`
        const commandId = `TestCommand_${randomSuffix}`

        app.registerExtension({
          name: extensionName,
          keybindings: [
            {
              combo: keyCombo,
              commandId: commandId
            }
          ],
          commands: [
            {
              id: commandId,
              function: eval(commandStr)
            }
          ]
        })
      },
      { keyCombo, commandStr: command.toString() }
    )
  }
}
