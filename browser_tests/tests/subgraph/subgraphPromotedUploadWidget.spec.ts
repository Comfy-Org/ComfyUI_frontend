import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

/**
 * A LoadImage node's "image" widget is promoted to the subgraph boundary
 * (via legacy `proxyWidgets` migration, or explicit "Promote Widget to
 * Parent"). Promotion links the widget's input slot, which the renderer
 * also uses as a signal to disable the widget -- correct for plain value
 * widgets, but it also disables the upload control itself, even though
 * uploading a new file has nothing to do with the promotion link.
 *
 * Fixture: a real user workflow ("Image Edit (Flux.2 Dev)") with a LoadImage
 * node inside a subgraph whose "image" widget is promoted to the subgraph's
 * boundary input.
 */
test.describe(
  'LoadImage upload widget inside a promoted subgraph',
  { tag: ['@vue-nodes', '@subgraph'] },
  () => {
    test('stays interactive after the image widget is promoted to the subgraph boundary', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/image-edit-flux2-loadimage-promoted'
      )

      const subgraphNodeId = await comfyPage.vueNodes.getNodeIdByTitle(
        'Image Edit (Flux.2 Dev)'
      )
      await comfyPage.vueNodes.enterSubgraph(subgraphNodeId)
      await comfyPage.nextFrame()
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      const loadImageId =
        await comfyPage.vueNodes.getNodeIdByTitle('Load Image')
      const node = comfyPage.vueNodes.getNodeLocator(loadImageId)

      const uploadInput = node.locator('input[type="file"]')
      await expect(uploadInput).toBeEnabled()

      const selectButton = node.getByRole('button', {
        name: 'Select image...'
      })
      await expect(selectButton).not.toHaveClass(/cursor-not-allowed/)

      const box = await node.boundingBox()
      if (!box) {
        throw new Error('Load Image node has no bounding box to drop onto')
      }

      await comfyPage.dragDrop.dragAndDropFile('test_upload_image.png', {
        dropPosition: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
        waitForUpload: true
      })

      const uploadedButton = node.getByRole('button', {
        name: 'test_upload_image.png',
        exact: true
      })
      await expect(uploadedButton).toBeVisible()

      // A successful upload must not leave the widget stuck disabled.
      await expect(uploadInput).toBeEnabled()
    })
  }
)
