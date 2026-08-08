import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'

test('Is not vulnarble to xss', async ({ comfyPage }) => {
  await test.step('in subgraph type', async () => {
    await comfyPage.workflow.loadWorkflow('xss/xss-e1-subgraph-type')
    const node = await comfyPage.nodeOps.getNodeRefById(10)
    await node.click('title', { button: 'right' })
    await comfyPage.contextMenu.clickLitegraphMenuItem('Properties Panel')
    await comfyPage.nextFrame()
    await expect(comfyPage.page.getByText('XSS E1')).toBeHidden()
  })

  await test.step('in property key', async () => {
    await comfyPage.workflow.loadWorkflow('xss/xss-e2-property-key')
    const node = await comfyPage.nodeOps.getNodeRefById(1)
    await node.click('title', { button: 'right' })
    await comfyPage.contextMenu.menuItems
      .getByText('Properties', { exact: true })
      .click()
    await comfyPage.contextMenu.clickLitegraphMenuItem('anything')
    await comfyPage.nextFrame()
    await expect(comfyPage.page.getByText('XSS E2')).toBeHidden()
  })
})
