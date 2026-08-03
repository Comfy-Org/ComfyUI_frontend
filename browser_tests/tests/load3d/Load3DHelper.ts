import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

export class Load3DHelper {
  constructor(readonly node: Locator) {}

  get canvas(): Locator {
    return this.node.locator('canvas')
  }

  get menuButton(): Locator {
    return this.node.getByTestId(TestIds.load3d.categoryMenu)
  }

  private get menuPanel(): Locator {
    return this.node.page().getByRole('dialog')
  }

  get recordingButton(): Locator {
    return this.node.getByRole('button', { name: 'Record', exact: true })
  }

  get stopRecordingButton(): Locator {
    return this.node.getByRole('button', { name: /stop recording/i })
  }

  get recordingMenuButton(): Locator {
    return this.node.getByTestId(TestIds.load3d.recordingDuration)
  }

  get downloadRecordingMenuItem(): Locator {
    return this.menuPanel.getByRole('button', { name: 'Download Recording' })
  }

  get startNewRecordingMenuItem(): Locator {
    return this.menuPanel.getByRole('button', { name: 'Start New Recording' })
  }

  get deleteRecordingMenuItem(): Locator {
    return this.menuPanel.getByRole('button', { name: 'Delete Recording' })
  }

  get gridToggleButton(): Locator {
    return this.node.getByRole('button', { name: /show grid/i })
  }

  get uploadBackgroundImageButton(): Locator {
    return this.node.getByRole('button', { name: 'BG Image' })
  }

  get removeBackgroundImageButton(): Locator {
    return this.node.getByRole('button', { name: 'Remove BG' })
  }

  get panoramaModeButton(): Locator {
    return this.node.getByRole('button', { name: /^panorama$/i })
  }

  get colorInput(): Locator {
    return this.node.locator('input[type="color"]')
  }

  get exportButton(): Locator {
    return this.node.getByRole('button', { name: 'Export', exact: true })
  }

  get openViewerButton(): Locator {
    return this.node.getByRole('button', { name: /open in 3d viewer/i })
  }

  getUploadButton(label: string): Locator {
    return this.node.getByText(label)
  }

  getMenuCategory(name: string): Locator {
    return this.menuPanel.getByRole('button', { name, exact: true })
  }

  get gizmoToggleButton(): Locator {
    // The category chip is also named "Gizmo" once that category is active;
    // only the toggle carries aria-pressed.
    return this.node
      .getByRole('button', { name: 'Gizmo' })
      .and(this.node.locator('[aria-pressed]'))
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
    return this.node.getByRole('button', { name: 'Reset', exact: true })
  }

  async openMenu(): Promise<void> {
    await this.menuButton.click()
  }

  async openRecordingMenu(): Promise<void> {
    await this.recordingMenuButton.click()
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
