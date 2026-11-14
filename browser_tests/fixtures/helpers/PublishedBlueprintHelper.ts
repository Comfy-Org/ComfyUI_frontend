import type { Page } from '@playwright/test'

import type { UserDataHelper } from '@e2e/fixtures/helpers/UserDataHelper'

/** A uniquely named user blueprint whose content loads can be held open. */
export class PublishedBlueprintHelper {
  readonly name = `test-persist-${Date.now()}`
  private markLoadHeld = () => {}
  /** Resolves once a held content request is waiting for `releaseLoads`. */
  readonly loadHeld = new Promise<void>((resolve) => {
    this.markLoadHeld = resolve
  })
  private releaseHeldLoads = () => {}
  private readonly loadsReleased = new Promise<void>((resolve) => {
    this.releaseHeldLoads = resolve
  })

  constructor(
    private readonly page: Page,
    private readonly userData: UserDataHelper
  ) {}

  private readonly isContentUrl = (url: URL) =>
    url.pathname.endsWith(`/userdata/subgraphs%2F${this.name}.json`)

  async holdLoads() {
    await this.page.route(this.isContentUrl, async (route) => {
      this.markLoadHeld()
      await this.loadsReleased
      await route.fallback()
    })
  }

  releaseLoads() {
    this.releaseHeldLoads()
  }

  async teardown() {
    this.releaseLoads()
    await this.page.unroute(this.isContentUrl)
    await this.userData.delete(`subgraphs/${this.name}.json`)
  }
}
