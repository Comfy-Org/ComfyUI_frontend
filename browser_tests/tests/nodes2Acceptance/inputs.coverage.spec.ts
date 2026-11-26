import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  addLoadImageShowing,
  boxOf,
  classicLoadImageHeight,
  classicSocketDiameter,
  classicWidgetInsets,
  expectImageShown,
  settledSavedSize,
  stepsSocketShown,
  uploadInputSolidImage,
  vueWidgetInsets,
  widgetRowTop
} from '@e2e/fixtures/helpers/nodes2AcceptanceInputLayout'
import {
  RENDERERS,
  addKSamplerWidget,
  center,
  ksamplerBodyRect,
  openKSamplerComboList,
  samplerOptions,
  setKSamplerWidgetValue,
  showKSamplerAtZoomOne,
  typeIntoNumber,
  widgetRow,
  widgetValue
} from '@e2e/fixtures/helpers/nodes2AcceptanceInputs'
import { TestIds } from '@e2e/fixtures/selectors'

for (const renderer of RENDERERS) {
  test.describe(
    `Node input coverage acceptance: ${renderer.name}`,
    { tag: ['@widget', '@node', '@nodes2-acceptance', ...renderer.tags] },
    () => {
      test('a socket dot is 8 px across', async ({ comfyPage }) => {
        const node = await showKSamplerAtZoomOne(comfyPage)

        const diameter = comfyPage.isVueNodes
          ? (
              await boxOf(
                comfyPage.vueNodes
                  .getInputSlotConnectionDot(String(node.id), 0)
                  .getByTestId('slot-dot'),
                'model socket dot'
              )
            ).width
          : await classicSocketDiameter(comfyPage, 'model')

        expect(diameter).toBeCloseTo(8, 0)
      })

      if (renderer.name === 'Nodes 2.0') {
        test('the title bar is 30 px tall', async ({ comfyPage }) => {
          await showKSamplerAtZoomOne(comfyPage)

          const height = (
            await boxOf(
              comfyPage.vueNodes
                .getNodeByTitle('KSampler')
                .locator('[data-testid^="node-header-"]'),
              'KSampler header'
            )
          ).height

          expect(height).toBeCloseTo(30, 0)
        })

        test('widget label and value text is 12 px', async ({ comfyPage }) => {
          await showKSamplerAtZoomOne(comfyPage)

          const row = comfyPage.vueNodes
            .getWidgetRowByLabel('KSampler', 'cfg')
            .first()
          await expect(row).toBeVisible()
          expect(
            await row
              .getByTestId(TestIds.widgets.layoutFieldLabel)
              .evaluate((element) => getComputedStyle(element).fontSize),
            'label'
          ).toBe('12px')
          expect(
            await row
              .locator('input')
              .evaluate((element) => getComputedStyle(element).fontSize),
            'value'
          ).toBe('12px')
        })
      }

      test('widgets are inset 15 px from each side of the node', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)

        const insets = comfyPage.isVueNodes
          ? await vueWidgetInsets(comfyPage, 'cfg')
          : await classicWidgetInsets(comfyPage, 'cfg')

        expect(insets.left, 'left inset').toBeCloseTo(15, 0)
        expect(insets.right, 'right inset').toBeCloseTo(15, 0)
      })

      test('a node with widgets cannot be resized narrower than 210 px', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        const { mouse } = comfyPage.page
        const node = await ksamplerBodyRect(comfyPage)
        const corner = comfyPage.isVueNodes
          ? center(
              await boxOf(
                (await comfyPage.vueNodes.getFixtureByTitle('KSampler')).resize
                  .bottomRight,
                'bottom-right resize handle'
              )
            )
          : { x: node.x + node.width - 4, y: node.y + node.height - 4 }

        await mouse.move(corner.x, corner.y)
        await mouse.down()
        await mouse.move(corner.x - 400, corner.y, { steps: 20 })
        await mouse.up()
        await comfyPage.nextFrame()

        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              () =>
                window.app!.graph.nodes.find((n) => n.type === 'KSampler')!
                  .size[0]
            )
          )
          .toBe(210)
      })

      test('Load Image with an image saves a size that includes the preview', async ({
        comfyPage,
        comfyFiles
      }) => {
        const filename = await uploadInputSolidImage(comfyPage, comfyFiles)
        const classicHeight = await classicLoadImageHeight(comfyPage, filename)

        const loadImage = await addLoadImageShowing(
          comfyPage,
          comfyPage.isVueNodes,
          filename
        )
        const [, height] = await settledSavedSize(comfyPage, loadImage)

        expect(height).toBe(classicHeight)
      })

      test('a multiline text node is at least 400 × 200', async ({
        comfyPage
      }) => {
        const clip = await comfyPage.nodeOps.addNode(
          'CLIPTextEncode',
          {},
          { x: 300, y: 500 }
        )
        await clip.centerOnNode()
        if (comfyPage.isVueNodes)
          await expect(
            comfyPage.vueNodes.getNodeLocator(String(clip.id))
          ).toBeVisible()

        const [width, height] = await settledSavedSize(comfyPage, clip.id)

        expect(width, 'width').toBeGreaterThanOrEqual(400)
        expect(height, 'height').toBeGreaterThanOrEqual(200)
      })

      test('switching renderers keeps the size of a Load Image node showing an image', async ({
        comfyPage,
        comfyFiles
      }) => {
        const filename = await uploadInputSolidImage(comfyPage, comfyFiles)
        const { isVueNodes } = comfyPage
        const loadImage = await addLoadImageShowing(
          comfyPage,
          isVueNodes,
          filename
        )
        const before = await settledSavedSize(comfyPage, loadImage)

        await comfyPage.menu.topbar.setVueNodesEnabled(!isVueNodes)
        await expectImageShown(comfyPage, loadImage, !isVueNodes)
        await comfyPage.menu.topbar.setVueNodesEnabled(isVueNodes)
        await expectImageShown(comfyPage, loadImage, isVueNodes)

        expect(await settledSavedSize(comfyPage, loadImage)).toEqual(before)
      })

      test('typing a maths expression into a number stores its result', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        await setKSamplerWidgetValue(comfyPage, 'cfg', 8)

        await typeIntoNumber(comfyPage, 'cfg', '2*3+1')
        await comfyPage.page.keyboard.press('Enter')

        await expect.poll(() => widgetValue(comfyPage, 'cfg')).toBe(7)
      })

      test('clicking 37% along a slider sets 37% of its range', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        await addKSamplerWidget(comfyPage, {
          type: 'slider',
          name: 'acceptance_slider',
          value: 0,
          options: { min: 0, max: 10, step2: 0.5 }
        })

        const track = comfyPage.isVueNodes
          ? await boxOf(
              comfyPage.vueNodes
                .getWidgetRowByLabel('KSampler', 'acceptance_slider')
                .first()
                .locator('[data-slot="slider-track"]'),
              'slider track'
            )
          : await widgetRow(comfyPage, 'acceptance_slider')
        await comfyPage.page.mouse.click(
          track.x + track.width * 0.37,
          center(track).y
        )

        await expect
          .poll(() => widgetValue(comfyPage, 'acceptance_slider'))
          .toBeCloseTo(3.7, 1)
      })

      test('arrow right in an open combo list jumps to the last option', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        const options = await samplerOptions(comfyPage)
        expect(options.length, 'sampler options').toBeGreaterThan(2)
        await setKSamplerWidgetValue(comfyPage, 'sampler_name', options[0])

        await openKSamplerComboList(comfyPage, 'sampler_name', {
          hasSearch: true
        })
        await comfyPage.page.keyboard.press('ArrowRight')
        await comfyPage.page.keyboard.press('Enter')

        await expect
          .poll(() => widgetValue(comfyPage, 'sampler_name'))
          .toBe(options.at(-1))
      })

      test('control after generate set to increment-wrap is not shown as randomize', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        await setKSamplerWidgetValue(
          comfyPage,
          'control_after_generate',
          'increment-wrap'
        )

        if (comfyPage.isVueNodes) {
          const control = comfyPage.vueNodes
            .getWidgetRowByLabel('KSampler', 'seed')
            .first()
            .getByTestId(TestIds.widgets.valueControl)
          await expect(control).toBeVisible()
          await expect(control).not.toHaveAccessibleName('Randomize Value')
          return
        }
        const shown = await comfyPage.page.evaluate(() => {
          const node = window.app!.graph.nodes.find(
            (n) => n.type === 'KSampler'
          )!
          const widget = node.widgets!.find(
            (w) => w.name === 'control_after_generate'
          )!
          return '_displayValue' in widget
            ? String(widget._displayValue)
            : undefined
        })
        expect(shown).toBe('increment-wrap')
      })

      if (renderer.name === 'Nodes 2.0') {
        test('a linked widget keeps a 24 px row pitch', async ({
          comfyPage
        }) => {
          await showKSamplerAtZoomOne(comfyPage)
          const primitive = await comfyPage.nodeOps.addNode(
            'PrimitiveInt',
            {},
            { x: 560, y: 120 }
          )
          const linked = await comfyPage.page.evaluate((id) => {
            const source = window.app!.graph.getNodeById(id)!
            const node = window.app!.graph.nodes.find(
              (n) => n.type === 'KSampler'
            )!
            const index = node.inputs.findIndex((slot) => slot.name === 'steps')
            source.connect(0, node, index)
            window.app!.canvas.setDirty(true, true)
            return node.inputs[index].link != null
          }, primitive.id)
          expect(linked, 'steps is linked').toBe(true)
          await comfyPage.nextFrame()

          await expect
            .poll(
              async () =>
                (await widgetRowTop(comfyPage, 'cfg')) -
                (await widgetRowTop(comfyPage, 'steps'))
            )
            .toBeCloseTo(24, 0)
        })
      }

      test('dragging a link over a node reveals a compatible widget socket', async ({
        comfyPage
      }) => {
        await showKSamplerAtZoomOne(comfyPage)
        const primitive = await comfyPage.nodeOps.addNode(
          'PrimitiveInt',
          {},
          { x: 560, y: 120 }
        )
        await comfyPage.nextFrame()
        const geometry = await comfyPage.page.evaluate((id) => {
          const source = window.app!.graph.getNodeById(id)!
          const node = window.app!.graph.nodes.find(
            (n) => n.type === 'KSampler'
          )!
          const [outX, outY] = window.app!.canvasPosToClientPos(
            source.getOutputPos(0)
          )
          const [titleX, titleY] = window.app!.canvasPosToClientPos([
            node.pos[0] + node.size[0] / 2,
            node.pos[1] - window.LiteGraph!.NODE_TITLE_HEIGHT / 2
          ])
          return {
            output: { x: outX, y: outY },
            title: { x: titleX, y: titleY }
          }
        }, primitive.id)
        const output = comfyPage.isVueNodes
          ? center(
              await boxOf(
                comfyPage.vueNodes
                  .getOutputSlotConnectionDot(String(primitive.id), 0)
                  .getByTestId('slot-dot'),
                'Int output socket'
              )
            )
          : geometry.output
        expect(
          await stepsSocketShown(comfyPage),
          'steps socket hidden before the drag'
        ).toBe(false)
        const { mouse } = comfyPage.page

        await mouse.move(output.x, output.y)
        await mouse.down()
        await mouse.move(geometry.title.x, geometry.title.y, { steps: 15 })

        await expect.poll(() => stepsSocketShown(comfyPage)).toBe(true)

        await mouse.move(output.x, output.y, { steps: 5 })
        await mouse.up()
      })
    }
  )
}
