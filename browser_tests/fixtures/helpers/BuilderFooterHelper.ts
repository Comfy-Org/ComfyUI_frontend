import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '../ComfyPage'
import { TestIds } from '../selectors'

export class BuilderFooterHelper {
  constructor(private readonly comfyPage: ComfyPage) {}

  private get page(): Page {
    return this.comfyPage.page
  }

  /** The builder footer nav containing save/navigation buttons. */
  get nav(): Locator {
    return this.page
      .getByRole('button', { name: 'Exit app builder' })
      .locator('..')
  }

  /** Get a button in the builder footer by its accessible name. */
  getButton(name: string | RegExp): Locator {
    return this.nav.getByRole('button', { name })
  }

  /** Click the save/save-as button in the builder footer. */
  async clickSave() {
    await this.getButton(/^Save/).first().click()
    await this.comfyPage.nextFrame()
  }

  /** Exit builder mode via the footer "Exit app builder" button. */
  async exitBuilder() {
    await this.page.getByRole('button', { name: 'Exit app builder' }).click()
    await this.comfyPage.nextFrame()
  }

  /** Open the save-as dialog via the split button chevron dropdown. */
  async openSaveAsDropdown() {
    await this.getButton('Save as').click()
    await this.page.getByRole('menuitem', { name: 'Save as' }).click()
    await this.comfyPage.nextFrame()
  }

  /** The "Opens as" popover tab above the builder footer. */
  get opensAsPopover(): Locator {
    return this.page.getByTestId(TestIds.builder.opensAs)
  }
}
