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
    await expect(apiNode.priceBadge.required, 'Has price badge').toBeVisible()

    await comfyPage.contextMenu
      .openForVueNode(apiNode.root)
      .then((m) => m.clickMenuItemExact('Convert to Subgraph'))
    const subgraphNode = await comfyPage.vueNodes.getFixtureByTitle('Subgraph')
    await expect(subgraphNode.root, 'Convert to Subgraph').toBeVisible()

    const nodePrice = subgraphNode.priceBadge.required
    await expect(nodePrice, 'subgraphNode has price badge').toBeVisible()
    const initialPrice = Number(await nodePrice.innerText())

    await comfyPage.subgraph.editor.togglePromotion(subgraphNode.root, {
      nodeName: apiNodeName,
      widgetName: 'price',
      toState: true
    })
    await comfyPage.vueNodes.selectComboOption('New Subgraph', 'price', '2x')
    await expect(nodePrice, 'Price is reactive').toHaveText(
      String(initialPrice * 2)
    )
  })

  test('Price badge part spacing', async ({ comfyPage }) => {
    await comfyPage.menu.topbar.newWorkflowButton.click()
    await comfyPage.nextFrame()

    await comfyPage.searchBoxV2.addNode(apiNodeName)
    const node = await comfyPage.vueNodes.getFixtureByTitle(apiNodeName)
    await expect(node.priceBadge.required).toBeVisible()
    await expect(node.priceBadge.rest).toBeVisible()

    const nodeBox = await node.boundingBox()
    const requiredBox = await node.priceBadge.required.boundingBox()
    const restBox = await node.priceBadge.rest.boundingBox()
    const requiredTextBox = await node.priceBadge.requiredText.boundingBox()
    const restTextBox = await node.priceBadge.restText.boundingBox()
    if (!(nodeBox && requiredBox && restBox && requiredTextBox && restTextBox))
      throw new Error('Pricing badge layout is unavailable')

    for (const box of [requiredBox, restBox]) {
      expect(box.x + box.width).toBeLessThanOrEqual(nodeBox.x + nodeBox.width)
      expect(box.y + box.height).toBeLessThanOrEqual(nodeBox.y + nodeBox.height)
    }
    expect(
      restTextBox.x - (requiredTextBox.x + requiredTextBox.width)
    ).toBeGreaterThan(0)
  })
})
