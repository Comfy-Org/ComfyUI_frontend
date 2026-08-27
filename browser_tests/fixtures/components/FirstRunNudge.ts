import type { Locator, Page } from '@playwright/test'

import { FIRST_RUN_SUGGESTIONS } from '@/renderer/extensions/firstRunTour/nudge/firstRunNudgeSuggestions'
import type { FirstRunSuggestionId } from '@/renderer/extensions/firstRunTour/nudge/firstRunNudgeSuggestions'

const ACTION_TEST_IDS = new RegExp(
  `^first-run-nudge-(${FIRST_RUN_SUGGESTIONS.map(({ id }) => id).join('|')})$`
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

  action(id: FirstRunSuggestionId): Locator {
    return this.root.getByTestId(`first-run-nudge-${id}`)
  }
}
