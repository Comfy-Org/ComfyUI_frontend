import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  RENDERERS,
  brightPixels,
  center,
  showKSamplerAtZoomOne,
  widgetRow
} from '@e2e/fixtures/helpers/nodes2AcceptanceInputs'

for (const renderer of RENDERERS) {
  test.describe(
    `Node input state acceptance: ${renderer.name}`,
    { tag: ['@widget', '@node', '@nodes2-acceptance', ...renderer.tags] },
    () => {
      test('a disabled number hides its value', async ({ comfyPage }) => {
        await showKSamplerAtZoomOne(comfyPage)
        const row = await widgetRow(comfyPage, 'steps')
        const valueArea = {
          x: row.x + row.width * 0.55,
          y: row.y,
          width: row.width * 0.45,
          height: row.height
        }
        expect(
          await brightPixels(comfyPage, valueArea),
          'value is visible before disabling'
        ).toBeGreaterThan(20)

        await comfyPage.page.evaluate(() => {
          const node = window.app!.graph.nodes.find(
            (n) => n.type === 'KSampler'
          )!
          node.widgets!.find((w) => w.name === 'steps')!.disabled = true
          window.app!.canvas.setDirty(true, true)
        })
        await comfyPage.nextFrame()

        await expect
          .poll(() => brightPixels(comfyPage, valueArea))
          .toBeLessThanOrEqual(3)
      })

      test('right-clicking a widget lists Favorite Widget and Rename Widget first', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        const row = await widgetRow(comfyPage, 'steps')

        await comfyPage.page.mouse.click(center(row).x, center(row).y, {
          button: 'right'
        })
        const items = comfyPage.contextMenu.menuItems
        await expect(items.first()).toBeVisible()
        const labels = (await items.allInnerTexts())
          .map((label) => label.trim())
          .filter((label) => label.length > 0)

        expect(labels[0], 'first entry').toMatch(/^Favorite Widget/)
        expect(labels[1], 'second entry').toMatch(/^Rename Widget/)
      })
    }
  )
}
