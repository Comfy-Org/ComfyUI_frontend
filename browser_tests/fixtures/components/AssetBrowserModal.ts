import type { Locator, Page } from '@playwright/test'

export class AssetBrowserModal {
  public readonly root: Locator
  public readonly assetGrid: Locator
  public readonly modelInfoPanel: Locator

  public readonly basicInfoSection: Locator
  public readonly modelTaggingSection: Locator
  public readonly modelDescriptionSection: Locator

  public readonly displayNameText: Locator
  public readonly editDisplayNameButton: Locator
  public readonly displayNameInput: Locator
  public readonly fileNameText: Locator
  public readonly sourceLink: Locator
  public readonly modelTypeSelect: Locator
  public readonly baseModelsInput: Locator
  public readonly additionalTagsInput: Locator
  public readonly descriptionText: Locator
  public readonly userDescriptionTextarea: Locator
  public readonly triggerPhrasesCopyAllButton: Locator
  public readonly triggerPhraseButtons: Locator
  public readonly selectModelPrompt: Locator

  constructor(public readonly page: Page) {
    this.root = page.locator('[data-component-id="AssetBrowserModal"]')
    this.assetGrid = this.root.locator('[data-component-id="AssetGrid"]')
    this.modelInfoPanel = page.locator('[data-component-id="ModelInfoPanel"]')

    const sections = this.modelInfoPanel.locator(':scope > div')
    this.basicInfoSection = sections.nth(0)
    this.modelTaggingSection = sections.nth(1)
    this.modelDescriptionSection = sections.nth(2)

    this.displayNameText = this.basicInfoSection
      .locator('.editable-text')
      .first()
    this.editDisplayNameButton = this.basicInfoSection.getByRole('button', {
      name: /edit/i
    })
    this.displayNameInput = this.basicInfoSection.locator('input[type="text"]')
    this.fileNameText = this.basicInfoSection
      .locator('span.break-all.text-muted-foreground')
      .first()
    this.sourceLink = this.basicInfoSection
      .locator('a[target="_blank"]')
      .first()

    this.modelTypeSelect = this.modelTaggingSection.getByRole('combobox')
    this.baseModelsInput = this.modelTaggingSection.locator('input').nth(0)
    this.additionalTagsInput = this.modelTaggingSection.locator('input').nth(1)

    this.descriptionText = this.modelDescriptionSection.locator('p').first()
    this.userDescriptionTextarea =
      this.modelDescriptionSection.locator('textarea')
    this.triggerPhrasesCopyAllButton = this.modelDescriptionSection.getByRole(
      'button',
      { name: /copy all/i }
    )
    this.triggerPhraseButtons = this.modelDescriptionSection
      .locator('button')
      .filter({ hasText: /.+/ })

    this.selectModelPrompt = this.root.locator('.wrap-break-word.text-muted')
  }

  async clickAsset(name: string): Promise<void> {
    await this.assetGrid
      .locator('[data-component-id="AssetCard"]')
      .filter({ hasText: name })
      .first()
      .click()
  }

  async waitForModelInfoPanel(): Promise<void> {
    await this.modelInfoPanel.waitFor({ state: 'visible' })
  }
}
