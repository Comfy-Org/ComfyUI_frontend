import type { Page, Locator } from '@playwright/test'

export class ComfyAppMenu {
  public readonly root: Locator
  public readonly queueButton: ComfyQueueButton

  constructor(public readonly page: Page) {
    this.root = page.locator('.app-menu')
    this.queueButton = new ComfyQueueButton(this)
  }
}

class ComfyQueueButton {
  public readonly root: Locator
  public readonly primaryButton: Locator
  public readonly dropdownButton: Locator
  constructor(public readonly appMenu: ComfyAppMenu) {
    this.root = appMenu.root.getByTestId('queue-button')
    this.primaryButton = this.root.locator('.p-splitbutton-button')
    this.dropdownButton = this.root.locator('.p-splitbutton-dropdown')
  }

  public async toggleOptions() {
    await this.dropdownButton.click()
    return new ComfyQueueButtonOptions(this.appMenu.page)
  }
}

class ComfyQueueButtonOptions {
  public readonly popup: Locator
  public readonly modes: {
    disabled: { input: Locator; wrapper: Locator }
    instant: { input: Locator; wrapper: Locator }
    change: { input: Locator; wrapper: Locator }
  }

  constructor(public readonly page: Page) {
    this.popup = page.getByTestId('queue-options')
    this.modes = (['disabled', 'instant', 'change'] as const).reduce(
      (modes, mode) => {
        modes[mode] = {
          input: page.locator(`#autoqueue-${mode}`),
          wrapper: page.getByTestId(`autoqueue-${mode}`)
        }
        return modes
      },
      {} as ComfyQueueButtonOptions['modes']
    )
  }

  public async setMode(mode: keyof ComfyQueueButtonOptions['modes']) {
    await this.modes[mode].input.click()
  }

  public async getMode() {
    return (
      await Promise.all(
        Object.entries(this.modes).map(async ([mode, opt]) => [
          mode,
          await opt.wrapper.getAttribute('data-p-checked')
        ])
      )
    ).find(([, checked]) => checked === 'true')?.[0]
  }
}
