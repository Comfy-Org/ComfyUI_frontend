import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Vue node header geometry', { tag: '@vue-nodes' }, () => {
  test('matches the graph title height when expanded and collapsed', async ({
    comfyPage
  }) => {
    const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    await expect(node.header).toBeVisible()
    await expect(node.body).toBeVisible()

    const expectedHeight = await comfyPage.page.evaluate(
      () => window.LiteGraph!.NODE_TITLE_HEIGHT
    )
    const headerHeight = () => node.header.evaluate((element) => element.offsetHeight)

    await expect.poll(headerHeight).toBe(expectedHeight)

    await node.toggleCollapse()
    await expect(node.body).toBeHidden()
    await expect.poll(headerHeight).toBe(expectedHeight)
  })
})
