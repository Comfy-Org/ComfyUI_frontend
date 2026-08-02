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

  test('Price badge stays within node bounds on a narrow node', async ({
    comfyPage
  }) => {
    await comfyPage.menu.topbar.newWorkflowButton.click()
    await comfyPage.nextFrame()

    await comfyPage.searchBoxV2.addNode(apiNodeName)
    const node = await comfyPage.vueNodes.getFixtureByTitle(apiNodeName)
    await expect(node.priceBadge.required).toBeVisible()
    await expect(node.priceBadge.requiredText).toBeVisible()

    const initialRequiredText = await node.priceBadge.requiredText.innerText()
    const initialRequiredBox = await node.priceBadge.required.boundingBox()
    if (!initialRequiredBox)
      throw new Error('Required price badge layout is unavailable')

    // Shrink the node down to its clamped minimum width - narrower than the
    // title + badge content naturally wants.
    const startBox = (await node.boundingBox())!
    await node.resizeFromCorner('SW', startBox.width + 200, 0)

    const getNodeBox = () => node.boundingBox()
    const getRequiredBox = () => node.priceBadge.required.boundingBox()
    await expect
      .poll(async () => (await getNodeBox())?.width)
      .toBeLessThan(startBox.width)

    const nodeBox = await getNodeBox()
    const requiredBox = await getRequiredBox()
    const restBox = await node.priceBadge.rest.boundingBox()
    if (!(nodeBox && requiredBox))
      throw new Error('Pricing badge layout is unavailable after resize')

    // The badge must never visually extend past the node's own bounds, even
    // when the header is too narrow to fit the title and badge together.
    for (const box of [requiredBox, restBox]) {
      if (!box) continue
      expect(box.x + box.width).toBeLessThanOrEqual(
        nodeBox.x + nodeBox.width + 0.5
      )
      expect(box.x).toBeGreaterThanOrEqual(nodeBox.x - 0.5)
    }

    // The credit number itself must stay fully legible: its text and pill
    // width must be unaffected by the squeeze (only the title or the unit
    // label are allowed to truncate/shrink first).
    await expect(node.priceBadge.requiredText).toHaveText(initialRequiredText)
    expect(requiredBox.width).toBeCloseTo(initialRequiredBox.width, 0)
  })
})
