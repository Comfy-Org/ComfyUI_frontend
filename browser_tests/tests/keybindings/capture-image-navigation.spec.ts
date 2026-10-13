import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe('Capture keyboard shortcuts', { tag: ['@canvas'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    const node = await comfyPage.nodeOps.getNodeRefByType('SaveImage')
    await comfyPage.nodeOps.selectNodeWithPan(node)
    await comfyPage.page.evaluate(async () => {
      const app = window.app
      const node = Object.values(app?.canvas.selected_nodes ?? {}).at(0)
      if (!app || !node) throw new Error('Save image node is unavailable')
      const images = await Promise.all(
        ['red', 'green', 'blue'].map(async (color) => {
          const image = new Image()
          image.src = `data:image/svg+xml,${encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="${color}"/></svg>`
          )}`
          await image.decode()
          return image
        })
      )
      node.imgs = images
      node.imageIndex = 0
      app.canvas.setDirty(true)
    })
    await comfyPage.nextFrame()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.canvasOps.resetView()
  })

  test('navigates and closes the selected node image without moving the node', async ({
    comfyPage
  }) => {
    const node = await comfyPage.nodeOps.getNodeRefByType('SaveImage')
    const position = await node.getPosition()
    await comfyPage.keyboard.press('ArrowRight')
    await expect.poll(() => node.getProperty('imageIndex')).toBe(1)
    await comfyPage.keyboard.press('ArrowLeft')
    await expect.poll(() => node.getProperty('imageIndex')).toBe(0)
    await comfyPage.keyboard.press('ArrowLeft')
    await expect.poll(() => node.getProperty('imageIndex')).toBe(2)
    await comfyPage.keyboard.press('Escape')
    await expect.poll(() => node.getProperty('imageIndex')).toBe(null)
    await expect.poll(() => node.getPosition()).toEqual(position)
  })
})
