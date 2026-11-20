import type { Locator } from '@playwright/test'

import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ClientRect } from '@e2e/fixtures/helpers/nodes2AcceptanceInputs'
import {
  RENDERERS,
  addKSamplerWidget,
  center,
  colourDistance,
  createSolidPng,
  ksamplerBodyRect,
  openKSamplerComboList,
  readScreenPixels,
  setKSamplerWidgetValue,
  showKSamplerAtZoomOne,
  typeIntoNumber,
  uploadInputImage,
  widgetRow,
  widgetValue
} from '@e2e/fixtures/helpers/nodes2AcceptanceInputs'
import { TestIds } from '@e2e/fixtures/selectors'

const SOLID_IMAGE = 'nodes2_acceptance_solid.png'
const SOLID_IMAGE_SIZE = 512

function kSamplerVueNode(comfyPage: ComfyPage) {
  return comfyPage.vueNodes.getNodeByTitle('KSampler')
}

async function boxOf(locator: Locator, what: string): Promise<ClientRect> {
  await expect(locator, `${what} is shown`).toBeVisible()
  const box = await locator.boundingBox()
  if (!box) throw new Error(`${what} has no box`)
  return box
}

async function classicSocketDiameter(comfyPage: ComfyPage, input: string) {
  const [x, y] = await comfyPage.page.evaluate((name) => {
    const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')!
    const index = node.inputs.findIndex((slot) => slot.name === name)
    return window.app!.canvasPosToClientPos(node.getInputPos(index))
  }, input)
  const rect = {
    x: Math.round(x) - 8,
    y: Math.round(y) - 8,
    width: 16,
    height: 16
  }
  const pixels = await readScreenPixels(comfyPage, rect)
  const background = pixels.rgb(0, 0)
  const fill = pixels.rgb(Math.floor(x) - rect.x, Math.floor(y) - rect.y)
  const contrast = colourDistance(fill, background)
  expect(contrast, `${input} socket is drawn`).toBeGreaterThan(60)
  let covered = 0
  for (let row = 0; row < pixels.height; row++)
    for (let column = 0; column < pixels.width; column++)
      covered += Math.min(
        1,
        colourDistance(pixels.rgb(column, row), background) / contrast
      )
  return 2 * Math.sqrt(covered / Math.PI)
}

async function classicWidgetInsets(comfyPage: ComfyPage, name: string) {
  const node = await ksamplerBodyRect(comfyPage)
  const row = await widgetRow(comfyPage, name)
  const strip = {
    x: Math.floor(node.x),
    y: Math.floor(center(row).y),
    width: Math.ceil(node.x + node.width) - Math.floor(node.x),
    height: 1
  }
  const pixels = await readScreenPixels(comfyPage, strip)
  const firstDrawn = (columns: number[]) => {
    const background = pixels.rgb(columns[0], 0)
    const column = columns.find(
      (x) => colourDistance(pixels.rgb(x, 0), background) > 30
    )
    if (column === undefined) throw new Error(`${name} row is not drawn`)
    return strip.x + column + 0.5
  }
  const inside = Array.from(
    { length: pixels.width - 6 },
    (_, index) => index + 3
  )
  return {
    left: firstDrawn(inside) - node.x,
    right: node.x + node.width - firstDrawn(inside.toReversed())
  }
}

async function vueWidgetInsets(comfyPage: ComfyPage, name: string) {
  const node = await boxOf(
    kSamplerVueNode(comfyPage).getByTestId(TestIds.node.innerWrapper),
    'KSampler node'
  )
  const control = await boxOf(
    kSamplerVueNode(comfyPage)
      .locator(`[data-widget-name="${name}"]`)
      .getByTestId(TestIds.widgets.numberRow),
    `${name} control`
  )
  return {
    left: control.x - node.x,
    right: node.x + node.width - (control.x + control.width)
  }
}

async function widgetRowTop(comfyPage: ComfyPage, name: string) {
  if (comfyPage.isVueNodes)
    return (
      await boxOf(
        kSamplerVueNode(comfyPage).locator(`[data-widget-name="${name}"]`),
        `${name} row`
      )
    ).y
  return (await widgetRow(comfyPage, name)).y
}

async function samplerOptions(comfyPage: ComfyPage): Promise<string[]> {
  return comfyPage.page.evaluate(() => {
    const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')!
    const values = node.widgets!.find((w) => w.name === 'sampler_name')!.options
      .values
    return Array.isArray(values) ? values.map(String) : []
  })
}

async function savedSize(comfyPage: ComfyPage, id: NodeId) {
  return comfyPage.page.evaluate((nodeId) => {
    const saved = window
      .app!.graph.serialize()
      .nodes.find((node) => String(node.id) === String(nodeId))
    if (!saved) throw new Error(`Node ${nodeId} is not saved`)
    return [saved.size[0], saved.size[1]]
  }, id)
}

async function settledSavedSize(comfyPage: ComfyPage, id: NodeId) {
  let previous = await savedSize(comfyPage, id)
  await expect
    .poll(async () => {
      await comfyPage.nextFrame()
      const next = await savedSize(comfyPage, id)
      const unchanged = next[0] === previous[0] && next[1] === previous[1]
      previous = next
      return unchanged
    })
    .toBe(true)
  return previous
}

async function expectImageShown(
  comfyPage: ComfyPage,
  id: NodeId,
  vueNodes: boolean
) {
  if (vueNodes) {
    const image = comfyPage.vueNodes
      .getNodeLocator(String(id))
      .getByTestId(TestIds.node.mainImage)
    await expect(image, 'Load Image preview is shown').toBeVisible()
    await expect
      .poll(() =>
        image.evaluate((img: HTMLImageElement) =>
          img.complete ? img.naturalWidth : 0
        )
      )
      .toBe(SOLID_IMAGE_SIZE)
    return
  }
  await expect
    .poll(
      () =>
        comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)!
          window.app!.canvas.setDirty(true, true)
          const loaded = node.imgs?.[0]?.naturalWidth ?? 0
          const previewed = node.widgets?.some(
            (widget) => widget.name === '$$canvas-image-preview'
          )
          return previewed ? loaded : 0
        }, id),
      { message: 'Load Image preview is drawn' }
    )
    .toBe(SOLID_IMAGE_SIZE)
}

async function addLoadImageShowing(comfyPage: ComfyPage, vueNodes: boolean) {
  const loadImage = await comfyPage.nodeOps.addNode(
    'LoadImage',
    {},
    { x: 300, y: 500 }
  )
  await comfyPage.page.evaluate(
    ([id, filename]) => {
      const node = window.app!.graph.getNodeById(id)!
      const widget = node.widgets!.find((w) => w.name === 'image')!
      widget.value = filename
      widget.callback?.(filename)
      window.app!.canvas.ds.scale = 1
    },
    [loadImage.id, SOLID_IMAGE] as const
  )
  await loadImage.centerOnNode()
  await expectImageShown(comfyPage, loadImage.id, vueNodes)
  return loadImage.id
}

async function classicLoadImageHeight(comfyPage: ComfyPage) {
  if (comfyPage.isVueNodes)
    await comfyPage.menu.topbar.setVueNodesEnabled(false)
  const probe = await addLoadImageShowing(comfyPage, false)
  const [, height] = await settledSavedSize(comfyPage, probe)
  await comfyPage.page.evaluate((id) => {
    window.app!.graph.remove(window.app!.graph.getNodeById(id)!)
  }, probe)
  if (comfyPage.isVueNodes) await comfyPage.menu.topbar.setVueNodesEnabled(true)
  return height
}

async function uploadSolidImage(comfyPage: ComfyPage) {
  await uploadInputImage(
    comfyPage,
    SOLID_IMAGE,
    createSolidPng(SOLID_IMAGE_SIZE, SOLID_IMAGE_SIZE, [200, 40, 40])
  )
}

async function stepsSocketShown(comfyPage: ComfyPage) {
  if (comfyPage.isVueNodes)
    return kSamplerVueNode(comfyPage)
      .locator('[data-widget-name="steps"]')
      .getByTestId('slot-dot')
      .evaluate((dot) => {
        let opacity = 1
        for (let e: Element | null = dot; e; e = e.parentElement)
          opacity *= Number(getComputedStyle(e).opacity)
        return opacity >= 0.5
      })
  const [x, y] = await comfyPage.page.evaluate(() => {
    const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')!
    window.app!.canvas.setDirty(true, true)
    const index = node.inputs.findIndex((slot) => slot.name === 'steps')
    return window.app!.canvasPosToClientPos(node.getInputPos(index))
  })
  const pixels = await readScreenPixels(comfyPage, {
    x: Math.round(x) - 5,
    y: Math.round(y) - 5,
    width: 9,
    height: 9
  })
  const background = pixels.rgb(0, 0)
  let drawn = 0
  for (let row = 0; row < pixels.height; row++)
    for (let column = 0; column < pixels.width; column++)
      if (colourDistance(pixels.rgb(column, row), background) > 30) drawn++
  return drawn >= 25
}

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

      test('the title bar is 30 px tall', async ({ comfyPage }) => {
        await showKSamplerAtZoomOne(comfyPage)

        const height = comfyPage.isVueNodes
          ? (
              await boxOf(
                kSamplerVueNode(comfyPage).locator(
                  '[data-testid^="node-header-"]'
                ),
                'KSampler header'
              )
            ).height
          : await comfyPage.page.evaluate(() => {
              const node = window.app!.graph.nodes.find(
                (n) => n.type === 'KSampler'
              )!
              const [, titleTop] = window.app!.canvasPosToClientPos([
                0,
                node.pos[1] - window.LiteGraph!.NODE_TITLE_HEIGHT
              ])
              const [, bodyTop] = window.app!.canvasPosToClientPos([
                0,
                node.pos[1]
              ])
              return bodyTop - titleTop
            })

        expect(height).toBeCloseTo(30, 0)
      })

      test('widget label and value text is 12 px', async ({ comfyPage }) => {
        await showKSamplerAtZoomOne(comfyPage)

        if (comfyPage.isVueNodes) {
          const row = comfyPage.vueNodes
            .getWidgetRowByLabel('KSampler', 'cfg')
            .first()
          const fontSize = (element: Element) =>
            getComputedStyle(element).fontSize
          await expect(row).toBeVisible()
          expect(
            await row
              .getByTestId(TestIds.widgets.layoutFieldLabel)
              .evaluate(fontSize),
            'label'
          ).toBe('12px')
          expect(await row.locator('input').evaluate(fontSize), 'value').toBe(
            '12px'
          )
          return
        }
        const font = await comfyPage.page.evaluate(
          () => window.app!.canvas.inner_text_font
        )
        expect(font.match(/\d+px/)?.[0]).toBe('12px')
      })

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
        comfyFiles.deleteAfterTest({ filename: SOLID_IMAGE, type: 'input' })
        await uploadSolidImage(comfyPage)
        const classicHeight = await classicLoadImageHeight(comfyPage)

        const loadImage = await addLoadImageShowing(
          comfyPage,
          comfyPage.isVueNodes
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
        comfyFiles.deleteAfterTest({ filename: SOLID_IMAGE, type: 'input' })
        await uploadSolidImage(comfyPage)
        const { isVueNodes } = comfyPage
        const loadImage = await addLoadImageShowing(comfyPage, isVueNodes)
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

      test('a linked widget keeps a 24 px row pitch', async ({ comfyPage }) => {
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
