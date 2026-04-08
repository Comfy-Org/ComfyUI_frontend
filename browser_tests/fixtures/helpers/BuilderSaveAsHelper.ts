import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export class BuilderSaveAsHelper {
  constructor(private readonly comfyPage: ComfyPage) {}

  private get page(): Page {
    return this.comfyPage.page
  }

  /** The save-as dialog (scoped by aria-labelledby). */
  get dialog(): Locator {
    return this.page.locator('[aria-labelledby="builder-save"]')
  }

  /** The post-save success dialog (scoped by aria-labelledby). */
  get successDialog(): Locator {
    return this.page.locator('[aria-labelledby="builder-save-success"]')
  }

  get title(): Locator {
    return this.dialog.getByText('Save as')
  }

  get radioGroup(): Locator {
    return this.dialog.getByRole('radiogroup')
  }

  get nameInput(): Locator {
    return this.dialog.getByRole('textbox')
  }

  viewTypeRadio(viewType: 'App' | 'Node graph'): Locator {
    return this.dialog.getByRole('radio', { name: viewType })
  }

  get saveButton(): Locator {
    return this.dialog.getByRole('button', { name: 'Save' })
  }

  get successMessage(): Locator {
    return this.successDialog.getByText('Successfully saved')
  }

  get viewAppButton(): Locator {
    return this.successDialog.getByRole('button', { name: 'View app' })
  }

  get closeButton(): Locator {
    return this.successDialog
      .getByRole('button', { name: 'Close', exact: true })
      .filter({ hasText: 'Close' })
  }

  /** The X button to dismiss the success dialog without any action. */
  get dismissButton(): Locator {
    return this.successDialog.locator('button.p-dialog-close-button')
  }

  get exitBuilderButton(): Locator {
    return this.successDialog.getByRole('button', { name: 'Exit builder' })
  }

  get overwriteDialog(): Locator {
    return this.page.getByRole('dialog', { name: 'Overwrite existing file?' })
  }

  get overwriteButton(): Locator {
    return this.overwriteDialog.getByRole('button', { name: 'Overwrite' })
  }

  async fillAndSave(workflowName: string, viewType: 'App' | 'Node graph') {
    await this.nameInput.fill(workflowName)
    await expect(this.viewTypeRadio(viewType)).toBeVisible()
    await this.viewTypeRadio(viewType).click()
    await expect(this.saveButton).toBeVisible()
    await this.saveButton.click()
  }
}
