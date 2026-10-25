import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const NODE_TYPE = 'DevToolsWASPause'

test.describe('WAS Pause live disabled getter', { tag: '@widget' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.nodeOps.addNode(NODE_TYPE, undefined, { x: 400, y: 200 })
    await comfyPage.nextFrame()
  })

  test(
    'Resume becomes clickable when execution pauses',
    { tag: '@canvas' },
    async ({ comfyPage }) => {
      const node = await comfyPage.nodeOps.getNodeRefByType(NODE_TYPE)
      const resume = await node.getWidgetByName('Resume')

      await test.step('Pause execution', async () => {
        await expect
          .poll(() => node.getProperty('properties'))
          .toMatchObject({ resumed: false })

        await comfyPage.page.evaluate(
          (id) =>
            window.dispatchEvent(
              new CustomEvent('devtools-was-pause', { detail: String(id) })
            ),
          node.id
        )
        await comfyPage.nextFrame()
      })

      await test.step('Resume execution through the canvas button', async () => {
        await resume.click()
        await expect
          .poll(() => node.getProperty('properties'))
          .toMatchObject({ resumed: true })
      })
    }
  )

  test(
    'Resume becomes enabled when execution pauses',
    { tag: '@vue-nodes' },
    async ({ comfyPage }) => {
      const node = await comfyPage.nodeOps.getNodeRefByType(NODE_TYPE)
      const button = comfyPage.vueNodes
        .getNodeLocator(node.id)
        .getByRole('button', { name: 'Resume', exact: true })

      await test.step('Pause execution', async () => {
        await expect
          .poll(() => node.getProperty('properties'))
          .toMatchObject({ resumed: false })

        await comfyPage.page.evaluate(
          (id) =>
            window.dispatchEvent(
              new CustomEvent('devtools-was-pause', { detail: String(id) })
            ),
          node.id
        )
        await comfyPage.nextFrame()
      })

      await test.step('Resume execution through the enabled Vue button', async () => {
        await expect(button).toBeVisible()
        await expect(button).toBeEnabled()
        await button.click()
        await expect
          .poll(() => node.getProperty('properties'))
          .toMatchObject({ resumed: true })
        await expect(button).toBeDisabled()
      })

      await test.step('Pause and resume a second execution', async () => {
        await comfyPage.page.evaluate(
          (id) =>
            window.dispatchEvent(
              new CustomEvent('devtools-was-pause', { detail: String(id) })
            ),
          node.id
        )
        await expect
          .poll(() => node.getProperty('properties'))
          .toMatchObject({ resumed: false })
        await expect(button).toBeEnabled()
        await button.click()
        await expect
          .poll(() => node.getProperty('properties'))
          .toMatchObject({ resumed: true })
        await expect(button).toBeDisabled()
      })
    }
  )

  test(
    'Resume becomes enabled after pausing in classic mode and switching to Vue',
    { tag: '@vue-nodes' },
    async ({ comfyPage }) => {
      const node = await comfyPage.nodeOps.getNodeRefByType(NODE_TYPE)
      const button = comfyPage.vueNodes
        .getNodeLocator(node.id)
        .getByRole('button', { name: 'Resume', exact: true })

      await test.step('Pause execution in classic mode', async () => {
        await comfyPage.menu.topbar.setVueNodesEnabled(false)
        await comfyPage.page.evaluate(
          (id) =>
            window.dispatchEvent(
              new CustomEvent('devtools-was-pause', { detail: String(id) })
            ),
          node.id
        )
        await comfyPage.nextFrame()
      })

      await test.step('Switch to Vue and resume execution', async () => {
        await comfyPage.menu.topbar.setVueNodesEnabled(true)
        await expect(button).toBeEnabled()
        await button.click()
        await expect
          .poll(() => node.getProperty('properties'))
          .toMatchObject({ resumed: true })
        await expect(button).toBeDisabled()
      })
    }
  )
})
