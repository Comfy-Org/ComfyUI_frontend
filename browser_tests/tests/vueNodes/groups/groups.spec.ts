import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../fixtures/ComfyPage'

const CREATE_GROUP_HOTKEY = 'Control+g'

test.describe('Vue Node Groups', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setSetting('Comfy.Minimap.ShowGroups', true)
    await comfyPage.vueNodes.waitForNodes()
  })

  test('should allow creating groups with hotkey', async ({ comfyPage }) => {
    await comfyPage.page.getByText('Load Checkpoint').click()
    await comfyPage.page.getByText('KSampler').click({ modifiers: ['Control'] })
    await comfyPage.page.keyboard.press(CREATE_GROUP_HOTKEY)
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'vue-groups-create-group.png'
    )
  })

  test('should allow fitting group to contents', async ({ comfyPage }) => {
    await comfyPage.setup()
    await comfyPage.loadWorkflow('groups/oversized_group')
    await comfyPage.ctrlA()
    await comfyPage.executeCommand('Comfy.Graph.FitGroupToContents')
    await comfyPage.nextFrame()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'vue-groups-fit-to-contents.png'
    )
  })
})
