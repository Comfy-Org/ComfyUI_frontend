import type { Locator, Page } from '@playwright/test'

export class FirstRunNudge {
  readonly root: Locator
  readonly actions: Locator
  readonly explore: Locator

  constructor(page: Page) {
    this.root = page.getByTestId('first-run-nudge')
    this.actions = this.root.getByTestId(
      /^first-run-nudge-(animate|upscale|restyle)$/
    )
    this.explore = this.root.getByTestId('first-run-nudge-explore')
  }

  action(id: string): Locator {
    return this.root.getByTestId(`first-run-nudge-${id}`)
  }
}
