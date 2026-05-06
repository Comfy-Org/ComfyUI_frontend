import type { Locator } from '@playwright/test'

import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'

/**
 * Click a menu item by exact label and wait for the menu to close.
 */
export async function clickExactMenuItem(comfyPage: ComfyPage, name: string) {
  await comfyPage.contextMenu.clickMenuItemExact(name)
  await expect(comfyPage.contextMenu.primeVueMenu).toBeHidden()
}

/**
 * Open the context menu for a single Vue node by title.
 * Selects the node first (required for correct menu items).
 */
export async function openContextMenu(
  comfyPage: ComfyPage,
  nodeTitle: string
): Promise<Locator> {
  const fixture = await comfyPage.vueNodes.getFixtureByTitle(nodeTitle)
  await comfyPage.contextMenu.openForVueNode(fixture.header)
  return comfyPage.contextMenu.primeVueMenu
}

/**
 * Open the context menu for multiple selected Vue nodes.
 */
export async function openMultiNodeContextMenu(
  comfyPage: ComfyPage,
  titles: string[]
): Promise<Locator> {
  if (titles.length === 0) {
    throw new Error('openMultiNodeContextMenu requires at least one title')
  }

  // deselectAll via evaluate — clearSelection() clicks at a fixed position
  // which can hit nodes or the toolbar overlay
  await comfyPage.page.evaluate(() => window.app!.canvas.deselectAll())
  await comfyPage.nextFrame()

  for (const title of titles) {
    const fixture = await comfyPage.vueNodes.getFixtureByTitle(title)
    await fixture.header.click({ modifiers: ['ControlOrMeta'] })
  }
  await comfyPage.nextFrame()

  const firstFixture = await comfyPage.vueNodes.getFixtureByTitle(titles[0])
  const box = await firstFixture.header.boundingBox()
  if (!box) throw new Error(`Header for "${titles[0]}" not found`)
  await comfyPage.page.mouse.click(
    box.x + box.width / 2,
    box.y + box.height / 2,
    { button: 'right' }
  )

  const menu = comfyPage.contextMenu.primeVueMenu
  await menu.waitFor({ state: 'visible' })
  return menu
}

/**
 * Get the inner wrapper locator for a Vue node by title.
 */
export function getNodeWrapper(
  comfyPage: ComfyPage,
  nodeTitle: string
): Locator {
  return comfyPage.vueNodes
    .getNodeByTitle(nodeTitle)
    .getByTestId(TestIds.node.innerWrapper)
}

/**
 * Get the first NodeReference matching the given title.
 */
export async function getNodeRef(
  comfyPage: ComfyPage,
  nodeTitle: string
): Promise<NodeReference> {
  const refs = await comfyPage.nodeOps.getNodeRefsByTitle(nodeTitle)
  const firstRef = refs[0]
  if (!firstRef) {
    throw new Error(`No node found with title "${nodeTitle}"`)
  }
  return firstRef
}
