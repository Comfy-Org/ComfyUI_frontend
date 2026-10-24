import { expect } from '@playwright/test'
import { z } from 'zod'

import { ComfyTemplates } from '@e2e/fixtures/components/Templates'
import { TestIds } from '@e2e/fixtures/selectors'

import { zComfyNode } from '@/platform/workflow/validation/schemas/workflowSchema'

const zTemplateRootNodes = z.object({
  nodes: z.array(zComfyNode.pick({ id: true, type: true })).min(1)
})

interface OpenedTemplate {
  id: string
  rootNodes: string[]
}

export interface ClickedTemplate {
  id: string
  opened: Promise<OpenedTemplate>
}

export class AgentTemplates extends ComfyTemplates {
  async openFirstTemplate(): Promise<OpenedTemplate> {
    return (await this.clickFirstTemplate()).opened
  }

  async clickFirstTemplate(
    holdResponseUntil?: Promise<void>
  ): Promise<ClickedTemplate> {
    await this.page.evaluate(() =>
      window.app!.extensionManager.command.execute('Comfy.BrowseTemplates')
    )
    await expect(this.content).toBeVisible()
    const first = this.allTemplateCards.first()
    await expect(first).toBeVisible()
    const testId = await first.getAttribute('data-testid')
    const id = testId?.slice(TestIds.templates.workflowCard('').length)
    if (!testId || !id) throw new Error(`template card has no id: ${testId}`)
    function isTemplateFile(url: string) {
      const { pathname } = new URL(url)
      return pathname.includes('templates/') && pathname.endsWith(`/${id}.json`)
    }
    if (holdResponseUntil)
      await this.page.route(
        (url) => isTemplateFile(url.href),
        async (route) => {
          await holdResponseUntil
          await route.fallback()
        }
      )
    const requested = this.page.waitForRequest((request) =>
      isTemplateFile(request.url())
    )
    const fetched = this.page.waitForResponse((response) =>
      isTemplateFile(response.url())
    )
    await this.content.getByTestId(testId).click()
    await requested
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
    return { id, opened }
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
}
