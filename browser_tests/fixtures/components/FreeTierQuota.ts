import type { Locator } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

export class FreeTierQuota {
  readonly root: Locator

  constructor(comfyPage: ComfyPage) {
    this.root = comfyPage.page.getByTestId(TestIds.topbar.freeTierQuota)
  }

  async getMax() {
    const text = await this.root.textContent()
    return text?.match(/(\d+) \/ (\d+)/)?.[2]
  }
  async getAvailable() {
    const text = await this.root.textContent()
    return text?.match(/(\d+) \/ (\d+)/)?.[1]
  }
}
