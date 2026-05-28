import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test(
  'Price badge displays on subgraphs',
  { tag: ['@vue-nodes'] },
  async ({ comfyPage }) => {
    const apiNodeName = 'Node With Price Badge'

    const priceBadge = comfyPage.page.locator('.lg-node-header i + span')
    const apiNode = comfyPage.vueNodes.getNodeByTitle(apiNodeName)

    await comfyPage.menu.topbar.newWorkflowButton.click()
    await comfyPage.nextFrame()

    await comfyPage.searchBoxV2.addNode(apiNodeName)
    await expect(apiNode, 'Add partner node').toBeVisible()
    await expect(apiNode.locator(priceBadge), 'Has price badge').toBeVisible()

    await comfyPage.contextMenu
      .openForVueNode(apiNode)
      .then((m) => m.clickMenuItemExact('Convert to Subgraph'))
    const subgraphNode = comfyPage.vueNodes.getNodeByTitle('New Subgraph')
    await expect(subgraphNode, 'Convert to Subgraph').toBeVisible()

    const nodePrice = subgraphNode.locator(priceBadge)
    await expect(nodePrice, 'subgraphNode has price badge').toBeVisible()
    const initialPrice = Number(await nodePrice.innerText())

    await comfyPage.subgraph.editor.togglePromotion(subgraphNode, {
      nodeName: apiNodeName,
      widgetName: 'price',
      toState: true
    })
    await comfyPage.vueNodes.selectComboOption('New Subgraph', 'price', '2x')
    await expect(nodePrice, 'Price is reactive').toHaveText(
      String(initialPrice * 2)
    )
  }
)
