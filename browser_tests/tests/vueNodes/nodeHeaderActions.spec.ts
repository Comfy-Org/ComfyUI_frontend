import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Vue Node Header Actions', { tag: '@node' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.Graph.CanvasMenu', false)
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setup()
    await comfyPage.vueNodes.waitForNodes()
  })

  test('Collapse button is visible on node header', async ({ comfyPage }) => {
    const vueNode = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    await expect(vueNode.collapseButton).toBeVisible()
  })

  test('Clicking collapse button hides node body', async ({ comfyPage }) => {
    const vueNode = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    await expect(vueNode.body).toBeVisible()

    await vueNode.toggleCollapse()
    await comfyPage.nextFrame()

    await expect(vueNode.body).toBeHidden()
  })

  test('Clicking collapse button again expands node', async ({ comfyPage }) => {
    const vueNode = await comfyPage.vueNodes.getFixtureByTitle('KSampler')

    await vueNode.toggleCollapse()
    await comfyPage.nextFrame()
    await expect(vueNode.body).toBeHidden()

    await vueNode.toggleCollapse()
    await comfyPage.nextFrame()
    await expect(vueNode.body).toBeVisible()
  })

  test('Double-click header enters title edit mode', async ({ comfyPage }) => {
    const vueNode = await comfyPage.vueNodes.getFixtureByTitle('KSampler')

    await vueNode.header.dblclick()
    await vueNode.titleEditor.expectVisible()
  })

  test('Title edit saves on Enter', async ({ comfyPage }) => {
    const vueNode = await comfyPage.vueNodes.getFixtureByTitle('KSampler')

    await vueNode.setTitle('My Custom Sampler')
    expect(await vueNode.getTitle()).toBe('My Custom Sampler')
  })

  test('Title edit cancels on Escape', async ({ comfyPage }) => {
    const vueNode = await comfyPage.vueNodes.getFixtureByTitle('KSampler')

    await vueNode.setTitle('Renamed Sampler')
    expect(await vueNode.getTitle()).toBe('Renamed Sampler')

    await vueNode.header.dblclick()
    await vueNode.titleEditor.input.fill('This Should Be Cancelled')
    await vueNode.titleEditor.cancel()
    await comfyPage.nextFrame()

    expect(await vueNode.getTitle()).toBe('Renamed Sampler')
  })
})
