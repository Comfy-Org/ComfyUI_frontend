import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

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

  get openViewerButton(): Locator {
    return this.node.getByRole('button', { name: /open in 3d viewer/i })
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

  async waitForWidgetValue(
    nodeId: number,
    widgetName: string,
    expected: string
  ): Promise<void> {
    await expect
      .poll(
        () =>
          this.node.page().evaluate(
            ({ nodeId, widgetName }) => {
              const n = window.app!.graph.getNodeById(nodeId)
              const w = n?.widgets?.find((w) => w.name === widgetName)
              return w?.value
            },
            { nodeId, widgetName }
          ),
        { timeout: 15000 }
      )
      .toContain(expected)
  }

  async waitForModelLoaded(): Promise<void> {
    await expect(this.node.getByTestId(TestIds.loading.overlay)).toBeHidden({
      timeout: 30000
    })
  }
}
