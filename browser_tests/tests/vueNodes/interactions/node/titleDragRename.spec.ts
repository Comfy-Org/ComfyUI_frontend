import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const pastClickDrift = 40

test.describe('Vue node title rename', { tag: ['@vue-nodes', '@node'] }, () => {
  test.use({
    initialSettings: { 'Comfy.Pointer.ClickDrift': 6 }
  })

  test('a dragging double-click leaves the title editor closed and a later double-click opens it', async ({
    comfyPage
  }) => {
    const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    const before = await node.boundingBox()
    if (!before) throw new Error('KSampler must be rendered')
    const headerBox = await node.header.boundingBox()
    if (!headerBox) throw new Error('KSampler header must be rendered')
    const start = {
      x: headerBox.x + headerBox.width / 2,
      y: headerBox.y + headerBox.height / 2
    }

    await comfyPage.page.mouse.move(start.x, start.y)
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.up()
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(start.x + pastClickDrift, start.y, {
      steps: 10
    })
    await comfyPage.page.mouse.up({ clickCount: 2 })
    await comfyPage.nextFrame()

    await expect
      .poll(async () => {
        const after = await node.boundingBox()
        return after ? after.x - before.x : 0
      })
      .toBeGreaterThan(6)
    await node.titleEditor.expectHidden()

    await node.header.dblclick()
    await comfyPage.nextFrame()
    await node.titleEditor.expectVisible()
  })
})
