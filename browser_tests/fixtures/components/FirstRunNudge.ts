import type { Locator, Page } from '@playwright/test'

import { FIRST_RUN_NUDGE_ACTIONS } from '@e2e/fixtures/data/firstRunTour'
import type { FirstRunNudgeAction } from '@e2e/fixtures/data/firstRunTour'

const ACTION_TEST_IDS = new RegExp(
  `^first-run-nudge-(${FIRST_RUN_NUDGE_ACTIONS.map(({ id }) => id).join('|')})$`
)

/** Post-first-run discovery card (FirstRunTourNudge.vue). */
export class FirstRunNudge {
  public readonly root: Locator
  /** The continuation actions only — the browse-all button is not one. */
  public readonly actions: Locator

  constructor(page: Page) {
    this.root = page.getByTestId('first-run-nudge')
    this.actions = this.root.getByTestId(ACTION_TEST_IDS)
  }

  action(id: FirstRunNudgeAction): Locator {
    return this.root.getByTestId(`first-run-nudge-${id}`)
  }
}
