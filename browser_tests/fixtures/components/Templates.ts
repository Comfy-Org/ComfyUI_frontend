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

  async expectMinimumCardCount(count: number) {
    await expect
      .poll(() => this.allTemplateCards.count())
      .toBeGreaterThanOrEqual(count)
  }

  async selectTemplate(id: string) {
    const templateCard = this.content.getByTestId(
      TestIds.templates.workflowCard(id)
    )
    await templateCard.scrollIntoViewIfNeeded()
    await templateCard.getByRole('img').click()
  }

  async openFirstTemplate(): Promise<string> {
    await this.page.evaluate(() =>
      window.app!.extensionManager.command.execute('Comfy.BrowseTemplates')
    )
    await expect(this.content).toBeVisible()
    const card = this.allTemplateCards.first()
    await expect(card).toBeVisible()
    const testId = await card.getAttribute('data-testid')
    const id = testId?.slice(TestIds.templates.workflowCard('').length)
    if (!id) throw new Error(`template card has no id: ${testId}`)
    await card.click()
    return id
  }

  /**
   * Waits until the template load has fully settled (the store releases it
   * only after the graph load and its error reporting finish), then checks
   * the active graph holds exactly the template's root nodes.
   */
  async expectTemplateOpened(id: string) {
    await expect(this.content).toBeHidden()
    await expect
      .poll(() =>
        this.page.evaluate(() => {
          const pinia =
            document.getElementById('vue-app')?.__vue_app__?.config
              .globalProperties.$pinia
          const store = pinia?._s.get('workflowTemplates') as
            | { loadingTemplateId: string | null }
            | undefined
          if (!store) throw new Error('workflowTemplates store is not mounted')
          return store.loadingTemplateId
        })
      )
      .toBeNull()
    const counts = await this.page.evaluate(async (templateId) => {
      const app = window.app!
      const response = await fetch(
        app.api.fileURL(`/templates/${templateId}.json`)
      )
      const json = (await response.json()) as { nodes: unknown[] }
      return { expected: json.nodes.length, actual: app.graph.nodes.length }
    }, id)
    expect(counts.actual).toBe(counts.expected)
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
