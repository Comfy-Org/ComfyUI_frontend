import {
  comfyPageFixture as test,
  comfyExpect as expect
} from './fixtures/ComfyPage'

// Old `nodeTemplate.ts` system
test.describe('Node Template', () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.clearNodeTemplates()
  })

  test('Can create and use node template', async ({ comfyPage }) => {
    const templateName = 'Can create node template template'

    await comfyPage.clearNodeTemplates()
    await comfyPage.reload()

    // TODO: Flaky test.  Right click requires delay after reload, but other interactions do not.
    await comfyPage.page.waitForTimeout(500)

    // Enter filename when prompt dialog shown
    comfyPage.page.on('dialog', (dialog) => dialog.accept(templateName))

    // Ctrl + drag over 3 nodes
    await comfyPage.dragAndDrop(
      { x: 175, y: 252 },
      { x: 483, y: 564 },
      'ControlOrMeta'
    )
    expect(await comfyPage.getGraphSelectedItemsCount()).toEqual(3)

    await comfyPage.rightClickCanvas()
    await comfyPage.clickContextMenuItem('Save Selected as Template')
    await comfyPage.nextFrame()

    await comfyPage.rightClickCanvas()
    await comfyPage.clickContextMenuItem('Node Templates >')
    await comfyPage.clickContextMenuItem(templateName)

    await expect(comfyPage.canvas).toHaveScreenshot()
  })

  test('Can load old format template', async ({ comfyPage }) => {
    await comfyPage.setNodeTemplates('vintage_clipboard_template.json')
    await comfyPage.reload()

    // TODO: Flaky test.  Right click requires delay after reload, but other interactions do not.
    await comfyPage.page.waitForTimeout(500)

    await comfyPage.rightClickCanvas()
    await comfyPage.clickContextMenuItem('Node Templates >')
    await comfyPage.clickContextMenuItem('vintageClipboard Template')

    await expect(comfyPage.canvas).toHaveScreenshot()
  })

  test('Can load new format template', async ({ comfyPage }) => {
    await comfyPage.setNodeTemplates('node_template_templates.json')
    await comfyPage.reload()

    // TODO: Flaky test.  Right click requires delay after reload, but other interactions do not.
    await comfyPage.page.waitForTimeout(500)

    await comfyPage.rightClickCanvas()
    await comfyPage.clickContextMenuItem('Node Templates >')
    await comfyPage.clickContextMenuItem('Three Nodes Template')

    await expect(comfyPage.canvas).toHaveScreenshot()
  })
})
