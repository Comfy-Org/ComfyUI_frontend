import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test('@vue-nodes Price badge displays on subgraphs', async ({ comfyPage }) => {
  const apiNodeName = 'Node With Price Badge'
  await comfyPage.settings.setSetting('Comfy.NodeSearchBoxImpl', 'v1 (legacy)')

  const priceBadge = comfyPage.page.locator('.lg-node-header i + span')
  const apiNode = comfyPage.vueNodes.getNodeByTitle(apiNodeName)

  await comfyPage.menu.topbar.newWorkflowButton.click()
  await comfyPage.nextFrame()

  await comfyPage.page.mouse.dblclick(500, 500, { delay: 5 })
  await comfyPage.searchBox.fillAndSelectFirstNode(apiNodeName)
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

  //TODO swap to promotion fixtures once PR lands
  await comfyPage.page.evaluate(() => {
    const subgraph = [...graph!.subgraphs.values()][0]
    const priceWidget = subgraph.nodes[0].widgets![0]
    priceWidget.value = '2x'
    priceWidget.callback!('2x')
  })
  /*
  await comfyPage.subgraph.toggleContainedWidgetPromotion(subgraphNode, {
    nodeName: apiNodeName,
    widgetName: 'price',
    toState: true
  })
  await comfyPage.vueNodes.selectComboOption('New Subgraph', 'price', '2x')
  */
  await expect(nodePrice, 'Price is reactive').toHaveText(
    String(initialPrice * 2)
  )
})
