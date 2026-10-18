import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import path from 'path'
import { z } from 'zod'

import type {
  TemplateInfo,
  WorkflowTemplates
} from '@/platform/workflow/templates/types/template'
import { zComfyNode } from '@/platform/workflow/validation/schemas/workflowSchema'
import { TestIds } from '@e2e/fixtures/selectors'

const zTemplateRootNodes = z.object({
  nodes: z.array(zComfyNode.pick({ id: true, type: true })).min(1)
})

export interface OpenedTemplate {
  id: string
  rootNodes: string[]
}

export interface ClickedTemplate {
  id: string
  requested: Promise<void>
  opened: Promise<OpenedTemplate>
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

  async openFirstTemplate(): Promise<OpenedTemplate> {
    return (await this.clickFirstTemplate()).opened
  }

  /** Clicks the first Browse Templates card; `hold` delays its template JSON response until it resolves. */
  async clickFirstTemplate(hold?: Promise<void>): Promise<ClickedTemplate> {
    await this.page.evaluate(() =>
      window.app!.extensionManager.command.execute('Comfy.BrowseTemplates')
    )
    await expect(this.content).toBeVisible()
    const first = this.allTemplateCards.first()
    await expect(first).toBeVisible()
    const testId = await first.getAttribute('data-testid')
    const id = testId?.slice(TestIds.templates.workflowCard('').length)
    if (!testId || !id) throw new Error(`template card has no id: ${testId}`)
    const isTemplateFile = (url: string) => {
      const { pathname } = new URL(url)
      return pathname.includes('templates/') && pathname.endsWith(`/${id}.json`)
    }
    if (hold)
      await this.page.route(
        (url) => isTemplateFile(url.href),
        async (route) => {
          await hold
          await route.fallback()
        }
      )
    const requested = this.page
      .waitForRequest((request) => isTemplateFile(request.url()))
      .then(() => undefined)
    const fetched = this.page.waitForResponse((response) =>
      isTemplateFile(response.url())
    )
    await this.content.getByTestId(testId).click()
    const opened = fetched.then(async (response) => {
      if (!response.ok())
        throw new Error(`template ${id} returned ${response.status()}`)
      const template: unknown = await response.json()
      const rootNodes = zTemplateRootNodes
        .parse(template)
        .nodes.map(({ id, type }) => `${id}:${type}`)
        .sort()
      return { id, rootNodes }
    })
    return { id, requested, opened }
  }

  async loadingTemplateId(): Promise<string | null | undefined> {
    return this.page.evaluate(() => {
      const pinia =
        document.getElementById('vue-app')?.__vue_app__?.config.globalProperties
          .$pinia
      const store = pinia?._s.get('workflowTemplates')
      return store && 'loadingTemplateId' in store
        ? store.loadingTemplateId
        : undefined
    })
  }

  async expectTemplateOpened({ rootNodes }: OpenedTemplate) {
    await expect(this.content).toBeHidden()
    await expect.poll(() => this.loadingTemplateId()).toBeNull()
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
