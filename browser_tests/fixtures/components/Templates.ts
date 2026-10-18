import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import path from 'path'
import { z } from 'zod'

import type {
  TemplateInfo,
  WorkflowTemplates
} from '@/platform/workflow/templates/types/template'
import { TestIds } from '@e2e/fixtures/selectors'

const zTemplateRootNodes = z.object({
  nodes: z
    .array(
      z.object({ id: z.union([z.number(), z.string()]), type: z.string() })
    )
    .min(1)
})

export interface OpenedTemplate {
  id: string
  /** Root nodes of the fetched template JSON as sorted `id:type` pairs. */
  rootNodes: string[]
}

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

  /**
   * Opens Browse Templates, clicks the first card and returns its id with
   * the root nodes (`id:type`, sorted) of the template JSON the app actually
   * fetched, so module-served templates are compared against their own file.
   */
  async openFirstTemplate(): Promise<OpenedTemplate> {
    await this.page.evaluate(() =>
      window.app!.extensionManager.command.execute('Comfy.BrowseTemplates')
    )
    await expect(this.content).toBeVisible()
    const first = this.allTemplateCards.first()
    await expect(first).toBeVisible()
    const testId = await first.getAttribute('data-testid')
    const id = testId?.slice(TestIds.templates.workflowCard('').length)
    if (!testId || !id) throw new Error(`template card has no id: ${testId}`)
    const fetched = this.page.waitForResponse((response) => {
      const { pathname } = new URL(response.url())
      return pathname.includes('templates/') && pathname.endsWith(`/${id}.json`)
    })
    await this.content.getByTestId(testId).click()
    const response = await fetched
    if (!response.ok())
      throw new Error(`template ${id} returned ${response.status()}`)
    const template: unknown = await response.json()
    const rootNodes = zTemplateRootNodes
      .parse(template)
      .nodes.map(({ id, type }) => `${id}:${type}`)
      .sort()
    return { id, rootNodes }
  }

  /**
   * Waits until the template load has fully settled (the store releases it
   * only after the graph load and its error reporting finish), then checks
   * the active graph holds the template's root nodes (same ids and types).
   */
  async expectTemplateOpened({ rootNodes }: OpenedTemplate) {
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
    await expect
      .poll(() =>
        this.page.evaluate(() =>
          window.app!.graph.nodes.map(({ id, type }) => `${id}:${type}`).sort()
        )
      )
      .toEqual(rootNodes)
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
