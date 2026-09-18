import type { Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { LocalDesktopTarget } from '@e2e/fixtures/customNode/ComfyTarget'
import { UserDataHelper } from '@e2e/fixtures/helpers/UserDataHelper'

export type LinkTuple = [string, number, string, number]

export class PackPersistenceHelper {
  readonly target = new LocalDesktopTarget()

  constructor(private readonly page: Page) {}

  projectInputLinks(targetId: string): Promise<LinkTuple[]> {
    return this.page.evaluate((id) => {
      const graph = window.app!.graph
      const target = graph.nodes.find((node) => String(node.id) === id)
      if (!target) throw new Error(`Target node ${id} is not mounted`)

      return target.inputs.flatMap((input, targetSlot) => {
        const link =
          input.link == null ? undefined : graph.links.get(input.link)
        return link
          ? [
              [
                String(link.origin_id),
                link.origin_slot,
                String(link.target_id),
                targetSlot
              ]
            ]
          : []
      })
    }, targetId)
  }
}

class SavedWorkflowCleanup {
  private readonly names = new Set<string>()

  constructor(private readonly comfyPage: ComfyPage) {}

  track(name: string): void {
    this.names.add(name)
  }

  async teardown(): Promise<void> {
    const userData = new UserDataHelper(
      this.comfyPage.request,
      this.comfyPage.id,
      this.comfyPage.url
    )
    await Promise.all(
      [...this.names].map((name) => userData.delete(`workflows/${name}.json`))
    )
  }
}

export const packPersistenceTest = comfyPageFixture.extend<{
  packPersistence: PackPersistenceHelper
  savedWorkflows: SavedWorkflowCleanup
}>({
  packPersistence: async ({ page }, use) => {
    await use(new PackPersistenceHelper(page))
  },
  savedWorkflows: async ({ comfyPage }, use) => {
    const cleanup = new SavedWorkflowCleanup(comfyPage)
    await use(cleanup)
    await cleanup.teardown()
  }
})
