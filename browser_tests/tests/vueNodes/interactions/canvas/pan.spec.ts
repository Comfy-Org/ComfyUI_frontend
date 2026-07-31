import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Vue Nodes Canvas Pan', { tag: '@vue-nodes' }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test(
    'Middle-click drag on a Vue node pans canvas',
    { tag: ['@canvas'] },
    async ({ comfyPage, comfyMouse }) => {
      const node = comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')
      const offsetBefore = await comfyPage.canvasOps.getOffset()

      await comfyMouse.middleDragFromCenter(
        node,
        { x: 140, y: 90 },
        { steps: 10 }
      )

      await expect
        .poll(() => comfyPage.canvasOps.getOffset())
        .not.toEqual(offsetBefore)
    }
  )

  test.describe('spacebar panning', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.Canvas.NavigationMode',
        'standard'
      )
      await comfyPage.workflow.loadWorkflow('vueNodes/simple-triple')
    })

    test('Space + left-drag on a Vue node pans canvas', async ({
      comfyPage,
      comfyMouse
    }) => {
      const node = comfyPage.vueNodes.getNodeByTitle('KSampler')
      const offsetBefore = await comfyPage.canvasOps.getOffset()

      await comfyPage.canvas.focus()
      await comfyPage.page.keyboard.down('Space')
      await expect.poll(() => comfyPage.canvasOps.isReadOnly()).toBe(true)
      try {
        await comfyMouse.dragElementBy(node, { x: 140, y: 90 })
      } finally {
        await comfyPage.page.keyboard.up('Space')
      }

      await expect
        .poll(() => comfyPage.canvasOps.getOffset())
        .not.toEqual(offsetBefore)
    })
  })

  test(
    '@mobile Can pan with touch',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      await comfyPage.canvasOps.panWithTouch(
        { x: 64, y: 64 },
        { x: 256, y: 256 }
      )
      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-nodes-paned-with-touch.png'
      )
    }
  )
})
