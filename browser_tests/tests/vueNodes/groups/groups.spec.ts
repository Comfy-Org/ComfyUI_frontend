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

    // Get group positions and screen coordinates for outer group
    const getGroupData = () =>
      comfyPage.page.evaluate(() => {
        const canvas = window['app'].canvas
        const groups = window['app'].graph.groups
        const outerGroup = groups.find(
          (g: { title: string }) => g.title === 'Outer Group'
        )
        const innerGroup = groups.find(
          (g: { title: string }) => g.title === 'Inner Group'
        )

        // Convert outer group title position to screen coordinates
        const screenPos = canvas.convertCanvasToOffset([
          outerGroup.pos[0] + 50,
          outerGroup.pos[1] + 15
        ])

        return {
          outer: { x: outerGroup.pos[0], y: outerGroup.pos[1] },
          inner: { x: innerGroup.pos[0], y: innerGroup.pos[1] },
          screenPos: { x: screenPos[0], y: screenPos[1] }
        }
      })

    const initial = await getGroupData()
    const initialOffsetX = initial.inner.x - initial.outer.x
    const initialOffsetY = initial.inner.y - initial.outer.y

    // Drag the outer group by its title area
    const dragDelta = { x: 100, y: 80 }
    await comfyPage.dragAndDrop(initial.screenPos, {
      x: initial.screenPos.x + dragDelta.x,
      y: initial.screenPos.y + dragDelta.y
    })

    // Get final positions
    const final = await getGroupData()
    const finalOffsetX = final.inner.x - final.outer.x
    const finalOffsetY = final.inner.y - final.outer.y

    // The relative offset should be maintained (inner group moved with outer)
    expect(finalOffsetX).toBeCloseTo(initialOffsetX, 0)
    expect(finalOffsetY).toBeCloseTo(initialOffsetY, 0)

    // Both groups should have moved
    expect(final.outer.x).not.toBe(initial.outer.x)
    expect(final.inner.x).not.toBe(initial.inner.x)
  })
})
