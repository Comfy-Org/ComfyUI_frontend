import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.fail('Branch Node', { tag: '@vue-nodes' }, async ({ comfyPage }) => {
  await comfyPage.nodeOps.clearGraph()
  await comfyPage.searchBoxV2.addNode('Branch', {
    position: { x: 700, y: 200 }
  })
  const branchNode = await comfyPage.vueNodes.getFixtureByTitle('Branch')

  const choiceWidget = branchNode.root.getByRole('combobox')
  const choiceMenu = comfyPage.page.getByTestId(
    'widget-select-default-viewport'
  )
  const options = choiceMenu.getByRole('option')
  async function withComboOptions(cb: () => Promise<void>) {
    await choiceWidget.click()
    await expect(choiceMenu).toBeVisible()

    await cb()

    await comfyPage.keyboard.press('Escape')
    await expect(choiceMenu).toBeHidden()
  }

  await expect(choiceWidget).toHaveText('branch0')
  await withComboOptions(
    async () =>
      await expect(options, 'single required option').toHaveText('branch0')
  )

  await test.step('Connect inputs', async () => {
    await comfyPage.searchBoxV2.addNode('Load Checkpoint')
    const loadNode = await comfyPage.vueNodes.getFixtureByTitle('Load Check')
    const loadSlot = loadNode.getSlot('MODEL')
    await expect(loadSlot).toBeVisible()
    for (let i = 0; i < 3; i++)
      await loadSlot.dragTo(branchNode.getSlot(`branch${i}`).first())
    await withComboOptions(
      async () => await expect(options, '3 branches added').toHaveCount(3)
    )
  })

  await test.step('Rename input', async () => {
    await branchNode.root.getByText('branch0').first().dblclick()
    await branchNode.root.locator('.editable-text input').fill('H3')
    await branchNode.root.locator('.editable-text input').press('Enter')
    await expect(choiceWidget, 'choice updates to new label').toHaveText('H3')
    await withComboOptions(
      async () => await expect(options.getByText('H3')).toBeVisible()
    )
  })

  await test.step('Remove selected input', async () => {
    await withComboOptions(
      async () => await options.getByText('branch2').click()
    )
    await expect(choiceWidget).toHaveText('branch2')
    const branchSlot = branchNode.getSlot(`branch2`).first()
    await branchSlot.click({ modifiers: ['Alt', 'Control'] })
    await expect(choiceWidget).not.toHaveText('branch2')
  })
})
