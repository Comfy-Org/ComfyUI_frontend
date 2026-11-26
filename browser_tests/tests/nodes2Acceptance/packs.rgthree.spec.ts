import { expectPointOnCanvasOrNode } from '@e2e/fixtures/helpers/nodes2AcceptancePacks.a2'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  BLUE,
  PACK_RENDERERS,
  PACK_TAGS,
  RED,
  addPackNode,
  countColour,
  expectPackLoaded,
  expectSplitColours,
  keepMixlabOffNodeDrawHooks,
  legacyWidgetPoint,
  nodeBodyPoint,
  nodeScreenRect,
  nodeValue,
  nodeGeometry,
  padRect,
  redrawCanvas,
  showEmptyGraphAtZoomOne,
  widgetState
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  REROUTE,
  RELAY,
  LABEL,
  POWER_LORA,
  FAST_GROUPS_BYPASSER,
  addImageComparerWithRunOutput,
  deliverComparerImages,
  greyLabelPixels
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.rgthree'

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `rgthree-comfy on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await expectPackLoaded(comfyPage, 'rgthree-comfy')
        await keepMixlabOffNodeDrawHooks(comfyPage)
        await showEmptyGraphAtZoomOne(comfyPage)
      })

      test('Image Comparer (run output delivered by an `executed` message) shows image B left of the hovered point', async ({
        comfyPage,
        comfyFiles
      }) => {
        const id = await addImageComparerWithRunOutput(comfyPage)
        await deliverComparerImages(comfyPage, comfyFiles, id)
        const area = await nodeScreenRect(comfyPage, id)
        await comfyPage.canvasOps.moveMouseToEmptyArea()
        await expect
          .poll(() => countColour(comfyPage, area, RED), {
            message: 'image A drawn'
          })
          .toBeGreaterThan(20_000)
        expect(await countColour(comfyPage, area, BLUE), 'idle image B').toBe(0)

        const hover = await nodeBodyPoint(comfyPage, id, 0.3, 0.6)
        await comfyPage.page.mouse.move(hover.x, hover.y, { steps: 4 })

        await expect(async () => {
          const red = await countColour(comfyPage, area, RED)
          const blue = await countColour(comfyPage, area, BLUE)
          expect(blue, 'image B left of the pointer').toBeGreaterThan(10_000)
          expect(blue / (red + blue), 'share of image B').toBeGreaterThan(0.15)
          expect(blue / (red + blue), 'share of image B').toBeLessThan(0.45)
        }).toPass({ timeout: 10_000 })
        await expectSplitColours(comfyPage, hover, BLUE, RED)
      })

      test('Image Comparer in Click mode (comparer_mode property) shows image B while the button is held', async ({
        comfyPage,
        comfyFiles
      }) => {
        const id = await addImageComparerWithRunOutput(comfyPage)
        await comfyPage.page.evaluate((nodeId) => {
          window.app!.graph.getNodeById(nodeId)!.properties.comparer_mode =
            'Click'
        }, id)
        await deliverComparerImages(comfyPage, comfyFiles, id)
        const area = await nodeScreenRect(comfyPage, id)
        await expect
          .poll(() => countColour(comfyPage, area, RED), {
            message: 'image A drawn'
          })
          .toBeGreaterThan(20_000)

        const press = await nodeBodyPoint(comfyPage, id, 0.5, 0.6)
        await comfyPage.page.mouse.move(press.x, press.y)
        await comfyPage.page.mouse.down()
        await expect
          .poll(() => countColour(comfyPage, area, BLUE), {
            message: 'image B while held'
          })
          .toBeGreaterThan(20_000)
        await comfyPage.page.mouse.up()
        await expect
          .poll(() => countColour(comfyPage, area, BLUE), {
            message: 'image B after release'
          })
          .toBe(0)
        expect(await countColour(comfyPage, area, RED)).toBeGreaterThan(20_000)
      })

      test('Reroute moves with the pointer while Shift+Z is held', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, REROUTE, [400, 300])
        const start = await nodeBodyPoint(comfyPage, id, 0.5, 0.5)
        await comfyPage.page.mouse.click(start.x, start.y)
        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              (nodeId) =>
                window.app!.canvas.selectedItems.has(
                  window.app!.graph.getNodeById(nodeId)!
                ),
              id
            )
          )
          .toBe(true)
        const { pos: before } = await nodeGeometry(comfyPage, id)

        const { keyboard, mouse } = comfyPage.page
        await mouse.move(start.x + 5, start.y + 5)
        await keyboard.down('Shift')
        await keyboard.down('KeyZ')
        await mouse.move(start.x + 125, start.y + 85, { steps: 8 })
        await keyboard.up('KeyZ')
        await keyboard.up('Shift')

        await expect(async () => {
          const { pos } = await nodeGeometry(comfyPage, id)
          expect(
            pos[0] - before[0],
            'x moved with the pointer'
          ).toBeGreaterThan(60)
          expect(
            pos[1] - before[1],
            'y moved with the pointer'
          ).toBeGreaterThan(40)
        }).toPass({ timeout: 10_000 })
      })

      test('Reroute draws its title as a label when showLabel is set', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, REROUTE, [300, 300], [160, 30])
        await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)!
          node.title = 'HELLO'
          node.properties.showLabel = false
        }, id)
        const withoutLabel = await greyLabelPixels(comfyPage, id)
        await comfyPage.page.evaluate((nodeId) => {
          window.app!.graph.getNodeById(nodeId)!.properties.showLabel = true
        }, id)

        await expect
          .poll(
            async () => (await greyLabelPixels(comfyPage, id)) - withoutLabel,
            {
              message: 'label pixels added by showLabel'
            }
          )
          .toBeGreaterThan(30)
      })

      test('Mute / Bypass Relay draws its mode mapping when it differs from the default', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, RELAY, [300, 300], [360, 80])
        const statusColour = await comfyPage.page.evaluate(() => {
          window.LiteGraph!.WIDGET_SECONDARY_TEXT_COLOR = '#ff00ff'
          return [255, 0, 255] as const
        })
        const area = padRect(await nodeScreenRect(comfyPage, id), 4)
        const defaultMapping = await countColour(
          comfyPage,
          area,
          statusColour,
          30
        )
        await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)!
          node.properties.on_muted_inputs = 'ACTIVE'
          node.setSize([360, 97])
        }, id)

        await expect
          .poll(
            async () =>
              (await countColour(
                comfyPage,
                padRect(await nodeScreenRect(comfyPage, id), 4),
                statusColour,
                30
              )) - defaultMapping,
            { message: 'status text pixels' }
          )
          .toBeGreaterThan(40)
      })

      test('Label opens its properties panel on double-click', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, LABEL, [300, 200], [300, 80])
        await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)!
          node.title = 'LABEL TEXT'
          node.properties.fontSize = 40
        }, id)
        await comfyPage.nextFrame()
        const target = await nodeBodyPoint(comfyPage, id, 0.5, 0.5)

        await comfyPage.page.mouse.dblclick(target.x, target.y, { delay: 5 })

        await expect(
          comfyPage.page.locator('.litegraph.dialog .dialog-title', {
            hasText: 'LABEL TEXT'
          })
        ).toBeVisible()
      })

      test('Power Lora Loader row toggles off and steps strength up when clicked', async ({
        comfyPage
      }) => {
        const id = await addPackNode(
          comfyPage,
          POWER_LORA,
          [100, 100],
          [420, 220]
        )
        const widgetName = await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)!
          const addRow: unknown = Reflect.get(node, 'addNewLoraWidget')
          if (typeof addRow !== 'function') return null
          const widget: { name: string } = addRow.call(node, 'demo.safetensors')
          window.app!.canvas.setDirty(true, true)
          return widget.name
        }, id)
        expect(widgetName, 'addNewLoraWidget is the pack API').not.toBeNull()
        const row = widgetName!
        const rowValue = (key: 'on' | 'strength') =>
          widgetState(comfyPage, id, row, ['value', key])
        const hitArea = async (area: 'toggle' | 'strengthInc') => {
          await expect
            .poll(async () => {
              await redrawCanvas(comfyPage)
              return widgetState(comfyPage, id, row, [
                'hitAreas',
                area,
                'bounds',
                '1'
              ])
            })
            .toBeGreaterThan(0)
          const [x, width] = (await widgetState(comfyPage, id, row, [
            'hitAreas',
            area,
            'bounds'
          ])) as number[]
          return legacyWidgetPoint(comfyPage, id, row, x + width / 2, 10)
        }
        expect(await rowValue('on')).toBe(true)

        const toggle = await hitArea('toggle')
        await comfyPage.page.mouse.click(toggle.x, toggle.y)
        await expect.poll(() => rowValue('on')).toBe(false)

        const increment = await hitArea('strengthInc')
        await comfyPage.page.mouse.click(increment.x, increment.y)
        await expect.poll(() => rowValue('strength')).toBeCloseTo(1.05, 5)
      })

      test('Fast Groups Bypasser bypasses the nodes of a group when its toggle is clicked', async ({
        comfyPage
      }) => {
        const memberId = await addPackNode(
          comfyPage,
          'EmptyLatentImage',
          [120, 400]
        )
        await comfyPage.page.evaluate(() => {
          const LiteGraph = window.LiteGraph!
          const group = new LiteGraph.LGraphGroup('Bypass me')
          group.pos = [80, 330]
          group.size = [400, 260]
          window.app!.graph.add(group)
          group.recomputeInsideNodes()
        })
        const id = await addPackNode(
          comfyPage,
          FAST_GROUPS_BYPASSER,
          [600, 100],
          [320, 120]
        )
        const toggleName = 'RGTHREE_TOGGLE_AND_NAV'
        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              ({ nodeId, toggleName }) =>
                window
                  .app!.graph.getNodeById(nodeId)!
                  .widgets?.filter((w) => w.name === toggleName).length ?? 0,
              { nodeId: id, toggleName }
            )
          )
          .toBe(1)
        if (comfyPage.isVueNodes)
          await expect(
            comfyPage.vueNodes
              .getNodeLocator(id)
              .locator(`[data-widget-name="${toggleName}"] canvas`)
          ).toBeVisible()
        expect(await nodeValue(comfyPage, memberId, ['mode'])).toBe(0)

        const toggle = await legacyWidgetPoint(
          comfyPage,
          id,
          toggleName,
          60,
          10
        )
        await expect(async () => {
          await expectPointOnCanvasOrNode(comfyPage, toggle, id)
        }).toPass({ timeout: 5000 })
        await comfyPage.page.mouse.click(toggle.x, toggle.y)

        await expect
          .poll(() => nodeValue(comfyPage, memberId, ['mode']))
          .toBe(4)
      })
    }
  )
}
