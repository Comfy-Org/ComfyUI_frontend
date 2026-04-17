import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

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

  async selectMenuCategory(name: string): Promise<void> {
    await this.getMenuCategory(name).click()
  }

  async clickGridToggle(): Promise<void> {
    await this.node.getByRole('button', { name: /show grid/i }).click()
  }

  async switchCameraType(): Promise<void> {
    await this.node.getByRole('button', { name: /switch camera/i }).click()
  }

  async selectMaterialMode(mode: string): Promise<void> {
    await this.node.getByRole('button', { name: /material mode/i }).click()
    await this.node.getByRole('button', { name: mode, exact: true }).click()
  }

  async setBackgroundColor(hex: string): Promise<void> {
    await this.colorInput.evaluate((el, value) => {
      ;(el as HTMLInputElement).value = value
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, hex)
  }

  async waitForModelLoaded(): Promise<void> {
    await expect(this.node.getByTestId(TestIds.loading.overlay)).toBeHidden({
      timeout: 30000
    })
  }
}

export async function getNodeConfig<T>(
  page: Page,
  nodeId: string,
  configKey: string
): Promise<T | null> {
  return page.evaluate(
    ({ id, key }) => {
      const node = window.app!.graph.getNodeById(Number(id))
      if (!node?.properties) return null
      return (
        ((node.properties as Record<string, unknown>)[key] as T | null) ?? null
      )
    },
    { id: nodeId, key: configKey }
  )
}
