import type { Locator, Page } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

/**
 * The graph/app view-mode toggle and its workflow actions dropdown.
 * A separate instance mounts in each host - the subgraph breadcrumb (graph
 * mode) and the app-mode center panel - and unmounts as the mode flips.
 */
export class WorkflowActionsDropdown {
  /** The segmented graph/app toggle hosting the workflow actions trigger. */
  public readonly viewModeToggle: Locator
  /** The active segment; opens the workflow actions menu. */
  public readonly trigger: Locator
  /** The inactive segment that switches into app mode. */
  public readonly enterAppModeSegment: Locator
  /** The inactive segment that switches back to the node graph. */
  public readonly enterGraphSegment: Locator
  /** The workflow actions dropdown menu. */
  public readonly menu: Locator

  constructor(page: Page) {
    this.viewModeToggle = page.getByTestId(
      TestIds.workflowActions.viewModeToggle
    )
    this.trigger = this.triggerIn(this.viewModeToggle)
    this.enterAppModeSegment = this.viewModeToggle.getByRole('button', {
      name: 'Enter app mode'
    })
    this.enterGraphSegment = this.viewModeToggle.getByRole('button', {
      name: 'Enter node graph'
    })
    this.menu = page.getByRole('menu', { name: 'Workflow actions' })
  }

  /** The trigger as rendered inside a specific mode's host. */
  triggerIn(host: Locator): Locator {
    return host.getByRole('button', { name: 'Workflow actions' })
  }
}
