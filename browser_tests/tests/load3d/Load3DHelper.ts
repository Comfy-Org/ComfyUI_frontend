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

  get stopRecordingButton(): Locator {
    return this.node.getByRole('button', { name: /stop recording/i })
  }

  get exportRecordingButton(): Locator {
    return this.node.getByRole('button', { name: /export recording/i })
  }

  get clearRecordingButton(): Locator {
    return this.node.getByRole('button', { name: /clear recording/i })
  }

  get gridToggleButton(): Locator {
    return this.node.getByRole('button', { name: /show grid/i })
  }

  get uploadBackgroundImageButton(): Locator {
    return this.node.getByRole('button', { name: /upload background image/i })
  }

  get removeBackgroundImageButton(): Locator {
    return this.node.getByRole('button', { name: /remove background image/i })
  }

  get panoramaModeButton(): Locator {
    return this.node.getByRole('button', { name: /^panorama$/i })
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

  get gizmoToggleButton(): Locator {
    return this.node.getByRole('button', { name: 'Gizmo' })
  }

  get gizmoTranslateButton(): Locator {
    return this.node.getByRole('button', { name: 'Translate' })
  }

  get gizmoRotateButton(): Locator {
    return this.node.getByRole('button', { name: 'Rotate' })
  }

  get gizmoScaleButton(): Locator {
    return this.node.getByRole('button', { name: 'Scale' })
  }

  get gizmoResetButton(): Locator {
    return this.node.getByRole('button', { name: 'Reset Transform' })
  }

  async openMenu(): Promise<void> {
    await this.menuButton.click()
  }

  async openGizmoCategory(): Promise<void> {
    await this.openMenu()
    await this.getMenuCategory('Gizmo').click()
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
