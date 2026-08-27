import type { Locator, Page } from '@playwright/test'

import type { FirstRunNudgeAction } from '@e2e/fixtures/data/postFirstRun'

export class FirstRunNudge {
  public readonly root: Locator
  public readonly actions: Locator

  constructor(private readonly page: Page) {
    this.root = page.getByTestId('first-run-nudge')
    this.actions = this.root.getByTestId(
      /^first-run-nudge-(animate|upscale|restyle)$/
    )
  }

  action(id: FirstRunNudgeAction): Locator {
    return this.page.getByTestId(`first-run-nudge-${id}`)
  }
}
