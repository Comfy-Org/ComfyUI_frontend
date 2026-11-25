import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { test } from '@e2e/fixtures/menuCompatibilityFixture'
import { openContextMenu } from '@e2e/fixtures/utils/contextMenuTestHelpers'

test.describe('Explicit node menu compatibility', { tag: '@vue-nodes' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
  })

  test.describe('Final menu mutations', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('default', {
        nodes: { '5': { widgets_values: [512, 768, 1] } }
      })
      await comfyPage.page.evaluate(() => {
        const canvas = window.app!.canvas
        const previous = canvas.getNodeMenuOptions
        canvas.getNodeMenuOptions = function (node) {
          const options = previous.call(this, node)
          return options.filter((item) => item?.content !== 'Copy').reverse()
        }
      })
    })

    test('preserves final menu mutations and swaps width and height once', async ({
      comfyPage
    }) => {
      const node =
        await comfyPage.nodeOps.getNodeRefByTitle('Empty Latent Image')
      const width = await node.getWidgetByName('width')
      const height = await node.getWidgetByName('height')
      const menu = await openContextMenu(comfyPage, 'Empty Latent Image')
      await expect(menu.getByRole('menuitem').first()).toHaveText('Go to node')
      await expect(
        menu.getByRole('menuitem', { name: 'Copy', exact: true })
      ).toHaveCount(0)
      await expect.poll(() => width.getValue()).toBe(512)
      await comfyPage.contextMenu.clickMenuItemExact('Swap width/height')
      await expect.poll(() => width.getValue()).toBe(768)
      await expect.poll(() => height.getValue()).toBe(512)
    })
  })

  test('Go to node centers the chosen real node only after selection', async ({
    comfyPage
  }) => {
    const sampler = await comfyPage.nodeOps.getNodeRefByTitle('KSampler')
    await openContextMenu(comfyPage, 'Empty Latent Image')
    const offset = await comfyPage.page.evaluate(() =>
      Array.from(window.app!.canvas.ds.offset)
    )
    await comfyPage.contextMenu.menuItem('Go to node').hover()
    await comfyPage.page
      .getByRole('menuitem', { name: 'KSampler', exact: true })
      .hover()
    await expect(
      comfyPage.page.getByRole('menuitem', { name: /^KSampler - #/ })
    ).toBeVisible()
    expect(
      await comfyPage.page.evaluate(() =>
        Array.from(window.app!.canvas.ds.offset)
      )
    ).toEqual(offset)
    await comfyPage.page
      .getByRole('menuitem', { name: /^KSampler - #/ })
      .click()
    const canvas = await comfyPage.canvas.boundingBox()
    if (!canvas) throw new Error('Expected the graph canvas')
    await expect
      .poll(async () => {
        const bounds = await sampler.getClientBounding()
        return Math.abs(
          bounds.x + bounds.width / 2 - canvas.x - canvas.width / 2
        )
      })
      .toBeLessThan(3)
  })

  test.describe('Imperative connection layout', () => {
    test.use({
      menuScenario: 'native',
      initialSettings: { 'Comfy.Canvas.SelectionToolbox': true }
    })

    test('opens the Vue menu from the keyboard with the legacy item', async ({
      comfyPage
    }) => {
      const node =
        await comfyPage.nodeOps.getNodeRefByTitle('Empty Latent Image')
      await node.centerOnNode()
      await node.click('title')
      const button = comfyPage.selectionToolbox.getByRole('button', {
        name: 'More Options',
        exact: true
      })
      await button.focus()
      await button.press('Enter')
      await expect(
        comfyPage.page.getByRole('menuitem', { name: 'Connections Layout' })
      ).toBeVisible()
      await expect(comfyPage.page.locator('.litecontextmenu')).toHaveCount(0)
    })

    test('runs the imperative submenu from the Vue menu and applies its selected property', async ({
      comfyPage
    }) => {
      const node =
        await comfyPage.nodeOps.getNodeRefByTitle('Empty Latent Image')
      await node.centerOnNode()
      const fixture =
        await comfyPage.vueNodes.getFixtureByTitle('Empty Latent Image')
      await comfyPage.contextMenu.openFor(fixture.header)
      await expect(comfyPage.page.locator('.litecontextmenu')).toHaveCount(0)
      const layout = comfyPage.page.getByRole('menuitem', {
        name: 'Connections Layout'
      })
      await expect(comfyPage.contextMenu.menuItem('Right -> Left')).toHaveCount(
        0
      )
      await layout.click()
      expect(await node.getProperty('properties')).not.toHaveProperty(
        'connections_layout'
      )
      await comfyPage.contextMenu.menuItem('Right -> Left').click()
      await expect
        .poll(() => node.getProperty('properties'))
        .toMatchObject({
          connections_layout: ['Right', 'Left']
        })
      await expect(comfyPage.page.locator('.litecontextmenu')).toHaveCount(0)
    })
  })

  test.describe('Complete method override', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.evaluate(() => {
        window.app!.canvas.getNodeMenuOptions = () => [
          { content: 'Replacement only' }
        ]
      })
    })

    test('does not regenerate core actions after a complete method override', async ({
      comfyPage
    }) => {
      const menu = await openContextMenu(comfyPage, 'Empty Latent Image')
      await expect(menu.getByRole('menuitem')).toHaveText(['Replacement only'])
    })
  })
})
