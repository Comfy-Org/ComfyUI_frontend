import type { Locator } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

export async function openContextMenu(
  comfyPage: ComfyPage,
  nodeTitle: string
): Promise<Locator> {
  await (await comfyPage.nodeOps.getNodeRefByTitle(nodeTitle)).centerOnNode()
  const fixture = await comfyPage.vueNodes.getFixtureByTitle(nodeTitle)
  await comfyPage.contextMenu.openForVueNode(fixture.header)
  return comfyPage.contextMenu.primeVueMenu
}

export async function openMultiNodeContextMenu(
  comfyPage: ComfyPage,
  titles: string[],
  contextTitle = titles[0]
): Promise<Locator> {
  if (titles.length === 0) {
    throw new Error('openMultiNodeContextMenu requires at least one title')
  }

  await comfyPage.page.evaluate(() => window.app!.canvas.deselectAll())
  await comfyPage.nextFrame()

  for (const title of titles) {
    await (await comfyPage.nodeOps.getNodeRefByTitle(title)).centerOnNode()
    const fixture = await comfyPage.vueNodes.getFixtureByTitle(title)
    await fixture.header.click({ modifiers: ['ControlOrMeta'] })
  }
  await comfyPage.nextFrame()

  await (await comfyPage.nodeOps.getNodeRefByTitle(contextTitle)).centerOnNode()
  const contextFixture =
    await comfyPage.vueNodes.getFixtureByTitle(contextTitle)
  await comfyPage.contextMenu.openFor(contextFixture.header)

  return comfyPage.contextMenu.primeVueMenu
}

export function getNodeWrapper(
  comfyPage: ComfyPage,
  nodeTitle: string
): Locator {
  return comfyPage.vueNodes
    .getNodeByTitle(nodeTitle)
    .getByTestId(TestIds.node.innerWrapper)
}
