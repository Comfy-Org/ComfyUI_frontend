import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

const apiNodeName = 'Node With Price Badge'

test.describe('Price badge', { tag: '@vue-nodes' }, () => {
  test('Price badge displays on subgraphs', async ({ comfyPage }) => {
    await comfyPage.menu.topbar.newWorkflowButton.click()
    await comfyPage.nextFrame()

    await comfyPage.searchBoxV2.addNode(apiNodeName)
    const apiNode = await comfyPage.vueNodes.getFixtureByTitle(apiNodeName)
    await expect(apiNode.root, 'Add partner node').toBeVisible()
    await expect(apiNode.priceBadge, 'Has price badge').toBeVisible()

    await comfyPage.contextMenu
      .openForVueNode(apiNode.root)
      .then((m) => m.clickMenuItemExact('Convert to Subgraph'))
    const subgraphNode = await comfyPage.vueNodes.getFixtureByTitle('Subgraph')
    await expect(subgraphNode.root, 'Convert to Subgraph').toBeVisible()

    const nodePrice = subgraphNode.priceBadge
    await expect(nodePrice, 'subgraphNode has price badge').toBeVisible()
    const initialPrice = Number.parseFloat(await nodePrice.innerText())

    await comfyPage.subgraph.editor.togglePromotion(subgraphNode.root, {
      nodeName: apiNodeName,
      widgetName: 'price',
      toState: true
    })
    await comfyPage.vueNodes.selectComboOption('New Subgraph', 'price', '2x')
    await expect(nodePrice, 'Price is reactive').toHaveText(
      `${initialPrice * 2} credits/Run`
    )
  })

  test('Price badge displays the complete label above the node', async ({
    comfyPage
  }) => {
    await comfyPage.menu.topbar.newWorkflowButton.click()
    await comfyPage.nextFrame()

    await comfyPage.searchBoxV2.addNode(apiNodeName)
    const node = await comfyPage.vueNodes.getFixtureByTitle(apiNodeName)
    await expect(node.priceBadge).toHaveText('211 credits/Run')

    const nodeBox = await node.boundingBox()
    const badgeBox = await node.priceBadge.boundingBox()
    if (!(nodeBox && badgeBox))
      throw new Error('Pricing badge layout is unavailable')

    expect(badgeBox.height).toBe(20)
    expect(badgeBox.x + badgeBox.width).toBeCloseTo(nodeBox.x + nodeBox.width)
    expect(badgeBox.y + badgeBox.height).toBeLessThan(nodeBox.y)
  })
})
