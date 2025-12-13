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

  test('should move nested groups together when dragging outer group', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('groups/nested-groups-1-inner-node')
    await comfyPage.nextFrame()

    // Get initial group positions
    const getGroupPositions = () =>
      comfyPage.page.evaluate(() => {
        const groups = window['app'].graph.groups
        return groups.map((g: { title: string; pos: number[] }) => ({
          title: g.title,
          x: g.pos[0],
          y: g.pos[1]
        }))
      })

    const initialPositions = await getGroupPositions()
    const outerInitial = initialPositions.find(
      (g: { title: string }) => g.title === 'Outer Group'
    )
    const innerInitial = initialPositions.find(
      (g: { title: string }) => g.title === 'Inner Group'
    )

    // Calculate initial offset between groups
    const initialOffsetX = innerInitial.x - outerInitial.x
    const initialOffsetY = innerInitial.y - outerInitial.y

    // Click on outer group title to select it
    const outerGroupTitle = comfyPage.page.getByText('Outer Group')
    await outerGroupTitle.click()
    await comfyPage.nextFrame()

    // Get title position for drag
    const titleBox = await outerGroupTitle.boundingBox()
    if (!titleBox) throw new Error('Outer Group title not found')

    // Drag the outer group
    const dragDelta = { x: 100, y: 80 }
    await comfyPage.dragAndDrop(
      {
        x: titleBox.x + titleBox.width / 2,
        y: titleBox.y + titleBox.height / 2
      },
      {
        x: titleBox.x + titleBox.width / 2 + dragDelta.x,
        y: titleBox.y + titleBox.height / 2 + dragDelta.y
      }
    )

    // Get final positions
    const finalPositions = await getGroupPositions()
    const outerFinal = finalPositions.find(
      (g: { title: string }) => g.title === 'Outer Group'
    )
    const innerFinal = finalPositions.find(
      (g: { title: string }) => g.title === 'Inner Group'
    )

    // Calculate final offset between groups
    const finalOffsetX = innerFinal.x - outerFinal.x
    const finalOffsetY = innerFinal.y - outerFinal.y

    // The relative offset should be maintained (inner group moved with outer)
    expect(finalOffsetX).toBeCloseTo(initialOffsetX, 0)
    expect(finalOffsetY).toBeCloseTo(initialOffsetY, 0)

    // Both groups should have moved
    expect(outerFinal.x).not.toBe(outerInitial.x)
    expect(innerFinal.x).not.toBe(innerInitial.x)
  })
})
