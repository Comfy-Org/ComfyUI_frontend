import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export class BuilderSaveAsHelper {
  /** The save-as dialog (scoped by aria-labelledby). */
  public readonly dialog: Locator
  /** The post-save success dialog (scoped by aria-labelledby). */
  public readonly successDialog: Locator
  public readonly title: Locator
  public readonly radioGroup: Locator
  public readonly nameInput: Locator
  public readonly saveButton: Locator
  public readonly successMessage: Locator
  public readonly viewAppButton: Locator
  public readonly closeButton: Locator
  /** The X button to dismiss the success dialog without any action. */
  public readonly dismissButton: Locator
  public readonly exitBuilderButton: Locator
  public readonly overwriteDialog: Locator
  public readonly overwriteButton: Locator

  constructor(private readonly comfyPage: ComfyPage) {
    this.dialog = this.page.locator('[aria-labelledby="builder-save"]')
    this.successDialog = this.page.locator(
      '[aria-labelledby="builder-save-success"]'
    )
    this.title = this.dialog.getByText('Save as')
    this.radioGroup = this.dialog.getByRole('radiogroup')
    this.nameInput = this.dialog.getByRole('textbox')
    this.saveButton = this.dialog.getByRole('button', { name: 'Save' })
    this.successMessage = this.successDialog.getByText('Successfully saved')
    this.viewAppButton = this.successDialog.getByRole('button', {
      name: 'View app'
    })
    this.closeButton = this.successDialog
      .getByRole('button', { name: 'Close', exact: true })
      .filter({ hasText: 'Close' })
    this.dismissButton = this.successDialog.locator(
      'button.p-dialog-close-button'
    )
    this.exitBuilderButton = this.successDialog.getByRole('button', {
      name: 'Exit builder'
    })
    this.overwriteDialog = this.page.getByRole('dialog', {
      name: 'Overwrite existing file?'
    })
    this.overwriteButton = this.overwriteDialog.getByRole('button', {
      name: 'Overwrite'
    })
  }

  private get page(): Page {
    return this.comfyPage.page
  }

  viewTypeRadio(viewType: 'App' | 'Node graph'): Locator {
    return this.dialog.getByRole('radio', { name: viewType })
  }

  async fillAndSave(workflowName: string, viewType: 'App' | 'Node graph') {
    await this.nameInput.fill(workflowName)
    await this.viewTypeRadio(viewType).click()
    await this.saveButton.click()
  }
}
