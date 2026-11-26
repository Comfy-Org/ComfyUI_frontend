import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  RENDERERS,
  addKSamplerWidget,
  clickEmptyCanvasAboveKSampler,
  ksamplerBodyRect,
  openKSamplerComboList,
  samplerOptions,
  saturatedPixels,
  setKSamplerWidgetValue,
  showKSamplerAtZoomOne,
  stepCombo,
  typeIntoNumber,
  widgetValue
} from '@e2e/fixtures/helpers/nodes2AcceptanceInputs'
import { TestIds } from '@e2e/fixtures/selectors'

for (const renderer of RENDERERS) {
  test.describe(
    `Node input value acceptance: ${renderer.name}`,
    { tag: ['@widget', '@node', '@nodes2-acceptance', ...renderer.tags] },
    () => {
      test('clicking away from a number being typed keeps the old value', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        await setKSamplerWidgetValue(comfyPage, 'steps', 20)

        await typeIntoNumber(comfyPage, 'steps', '99')
        await clickEmptyCanvasAboveKSampler(comfyPage)

        expect(await widgetValue(comfyPage, 'steps')).toBe(20)
      })

      test('typing a number above its maximum stores the maximum', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)

        await typeIntoNumber(comfyPage, 'cfg', '500')
        await comfyPage.page.keyboard.press('Enter')

        await expect.poll(() => widgetValue(comfyPage, 'cfg')).toBe(100)
      })

      test('typing a comma decimal in English leaves the number unchanged', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        await setKSamplerWidgetValue(comfyPage, 'cfg', 8)

        await typeIntoNumber(comfyPage, 'cfg', '2,5')
        await comfyPage.page.keyboard.press('Enter')
        await comfyPage.nextFrame()

        expect(await widgetValue(comfyPage, 'cfg')).toBe(8)
      })

      test('a number shows its value formatted by toFixed at its precision', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        await addKSamplerWidget(comfyPage, {
          type: 'number',
          name: 'acceptance_precise',
          value: 1.005,
          options: { min: 0, max: 10, step2: 0.01, precision: 2 }
        })

        const shown = comfyPage.isVueNodes
          ? await comfyPage.vueNodes
              .getWidgetRowByLabel('KSampler', 'acceptance_precise')
              .first()
              .locator('input')
              .inputValue()
          : await comfyPage.page.evaluate(() => {
              const node = window.app!.graph.nodes.find(
                (n) => n.type === 'KSampler'
              )!
              const widget = node.widgets!.find(
                (w) => w.name === 'acceptance_precise'
              )!
              return '_displayValue' in widget
                ? String(widget._displayValue)
                : undefined
            })

        expect(shown).toBe('1.00')
      })

      test('a knob widget is drawn', async ({ comfyPage }) => {
        await showKSamplerAtZoomOne(comfyPage)
        await addKSamplerWidget(comfyPage, {
          type: 'knob',
          name: 'acceptance_knob',
          value: 5,
          options: { min: 0, max: 10, step2: 0.1 }
        })
        await comfyPage.page.evaluate(() => {
          const node = window.app!.graph.nodes.find(
            (n) => n.type === 'KSampler'
          )!
          node.setSize(node.computeSize())
          window.app!.canvas.setDirty(true, true)
        })
        await comfyPage.nextFrame()

        const body = await ksamplerBodyRect(comfyPage)
        const knobArea = comfyPage.isVueNodes
          ? await comfyPage.vueNodes
              .getNodeByTitle('KSampler')
              .locator('[data-widget-name="acceptance_knob"]')
              .getByTestId(TestIds.widgets.legacyCanvas)
              .boundingBox()
          : {
              x: body.x + 15,
              y: body.y + body.height - 64,
              width: body.width - 30,
              height: 64
            }

        expect(knobArea, 'knob area exists').not.toBeNull()
        expect(
          await saturatedPixels(comfyPage, knobArea!),
          'coloured knob pixels'
        ).toBeGreaterThan(200)
      })

      test('the next arrow on the last combo option keeps the last option', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        const options = await samplerOptions(comfyPage)
        const last = options.at(-1)!
        await setKSamplerWidgetValue(comfyPage, 'sampler_name', last)

        await stepCombo(comfyPage, 'sampler_name', 'next')

        expect(await widgetValue(comfyPage, 'sampler_name')).toBe(last)
      })

      test('arrow up from the first option of an open combo list wraps to the last', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        const options = await samplerOptions(comfyPage)
        await setKSamplerWidgetValue(comfyPage, 'sampler_name', options[0])

        await openKSamplerComboList(comfyPage, 'sampler_name', {
          hasSearch: true
        })
        await comfyPage.page.keyboard.press('ArrowUp')
        await comfyPage.page.keyboard.press('Enter')

        await expect
          .poll(() => widgetValue(comfyPage, 'sampler_name'))
          .toBe(options.at(-1))
      })

      test('a combo whose values are an object lists their labels', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        await addKSamplerWidget(comfyPage, {
          type: 'combo',
          name: 'acceptance_object_combo',
          value: 'k1',
          options: {
            values: { k1: 'Label one', k2: 'Label two', k3: 'Label three' }
          }
        })

        await openKSamplerComboList(comfyPage, 'acceptance_object_combo', {
          hasSearch: false
        })

        await expect(
          comfyPage.page
            .locator('.litemenu-entry')
            .or(comfyPage.page.getByRole('option'))
            .filter({ hasText: 'Label two' })
        ).toBeVisible()
      })

      test('Load Image steps to the next file with its next arrow', async ({
        comfyPage
      }) => {
        const loadImage = await comfyPage.nodeOps.addNode(
          'LoadImage',
          {},
          { x: -900, y: 200 }
        )
        await comfyPage.page.evaluate((id) => {
          const node = window.app!.graph.getNodeById(id)!
          const widget = node.widgets!.find((w) => w.name === 'image')!
          widget.options.values = ['acceptance_a.png', 'acceptance_b.png']
          widget.value = 'acceptance_a.png'
          window.app!.canvas.ds.scale = 1
          window.app!.canvas.setDirty(true, true)
        }, loadImage.id)
        await loadImage.centerOnNode()

        if (comfyPage.isVueNodes) {
          const next = comfyPage.vueNodes
            .getWidgetRowByLabel('Load Image', 'image')
            .first()
            .getByRole('button', { name: /next/i })
          await expect(next, 'next arrow').toHaveCount(1)
          await next.click()
        } else {
          await expect
            .poll(() =>
              comfyPage.page.evaluate((id) => {
                window.app!.canvas.setDirty(true, true)
                return window
                  .app!.graph.getNodeById(id)!
                  .widgets!.find((w) => w.name === 'image')!.last_y
              }, loadImage.id)
            )
            .toBeDefined()
          const point = await comfyPage.page.evaluate((id) => {
            const node = window.app!.graph.getNodeById(id)!
            const widget = node.widgets!.find((w) => w.name === 'image')!
            return window.app!.canvasPosToClientPos([
              node.pos[0] + node.size[0] - 20,
              node.pos[1] +
                widget.last_y! +
                window.LiteGraph!.NODE_WIDGET_HEIGHT / 2
            ])
          }, loadImage.id)
          await comfyPage.page.mouse.click(point[0], point[1])
        }

        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              (id) =>
                window
                  .app!.graph.getNodeById(id)!
                  .widgets!.find((w) => w.name === 'image')!.value,
              loadImage.id
            )
          )
          .toBe('acceptance_b.png')
      })
    }
  )
}
