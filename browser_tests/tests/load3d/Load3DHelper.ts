import type { Locator } from '@playwright/test'

export class Load3DHelper {
  constructor(readonly node: Locator) {}

  get canvas(): Locator {
    return this.node.locator('canvas')
  }

  get menuButton(): Locator {
    return this.node.getByRole('button', { name: /show menu/i })
  }

  get recordingButton(): Locator {
    return this.node.getByRole('button', { name: /start recording/i })
  }

  get colorInput(): Locator {
    return this.node.locator('input[type="color"]')
  }

  getUploadButton(label: string): Locator {
    return this.node.getByText(label)
  }

  getMenuCategory(name: string): Locator {
    return this.node.getByText(name, { exact: true })
  }

  async openMenu(): Promise<void> {
    await this.menuButton.click()
  }

  async setBackgroundColor(hex: string): Promise<void> {
    await this.colorInput.evaluate((el, value) => {
      ;(el as HTMLInputElement).value = value
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, hex)
  }
}
