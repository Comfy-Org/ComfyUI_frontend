import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import path from 'path'

import type {
  TemplateInfo,
  WorkflowTemplates
} from '@/platform/workflow/templates/types/template'
import { TestIds } from '@e2e/fixtures/selectors'

export class ComfyTemplates {
  readonly content: Locator
  readonly allTemplateCards: Locator

  constructor(readonly page: Page) {
    this.content = page.getByTestId(TestIds.templates.content)
    this.allTemplateCards = page.locator('[data-testid^="template-workflow-"]')
  }

  /**
   * The templates browser auto-opens for a fresh user; its overlay swallows
   * pointer events. Dismiss it if present before driving other UI.
   */
  async closeIfOpen() {
    const dialog = this.page.getByRole('dialog').filter({ has: this.content })
    const closeButton = dialog.getByRole('button', { name: 'Close dialog' })
    await closeButton
      .waitFor({ state: 'visible', timeout: 1_000 })
      .catch(() => undefined)
    if (await closeButton.isVisible()) {
      await closeButton.click()
      await expect(dialog).toBeHidden()
    }
  }

  async expectMinimumCardCount(count: number) {
    await expect
      .poll(() => this.allTemplateCards.count())
      .toBeGreaterThanOrEqual(count)
  }

  async loadTemplate(id: string) {
    const templateCard = this.content.getByTestId(
      TestIds.templates.workflowCard(id)
    )
    await templateCard.scrollIntoViewIfNeeded()
    await templateCard.getByRole('img').click()
  }

  async getAllTemplates(): Promise<TemplateInfo[]> {
    const templates: WorkflowTemplates[] = await this.page.evaluate(() =>
      window.app!.api.getCoreWorkflowTemplates()
    )
    return templates.flatMap((t) => t.templates)
  }

  getTemplatePath(filename: string): string {
    return path.join('public', 'templates', filename)
  }
}
