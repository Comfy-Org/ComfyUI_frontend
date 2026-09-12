import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { Locator } from '@playwright/test'

async function expectRenderedTextUnclipped(
  text: Locator,
  screenshotTarget: Locator
) {
  const clipping = await text.evaluate(
    (element, target) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const laidOut = range.getBoundingClientRect()
      const style = getComputedStyle(element)
      const natural = document.createElement('span')
      natural.textContent = element.textContent
      natural.style.cssText =
        'position:fixed;visibility:hidden;width:max-content;max-width:none;white-space:pre'
      natural.style.font = style.font
      natural.style.letterSpacing = style.letterSpacing
      natural.style.textTransform = style.textTransform
      document.body.append(natural)
      range.selectNodeContents(natural)
      const naturalWidth = range.getBoundingClientRect().width
      natural.remove()
      const scaleX =
        element instanceof HTMLElement && element.offsetWidth > 0
          ? element.getBoundingClientRect().width / element.offsetWidth
          : 1
      const visible = (target as HTMLElement).getBoundingClientRect().toJSON()
      let ancestor: Element | null = element

      while (ancestor) {
        const ancestorStyle = getComputedStyle(ancestor)
        if (
          [
            ancestorStyle.overflow,
            ancestorStyle.overflowX,
            ancestorStyle.overflowY
          ].some((overflow) =>
            ['hidden', 'clip', 'scroll', 'auto'].includes(overflow)
          )
        ) {
          const bounds = ancestor.getBoundingClientRect()
          visible.bottom = Math.min(visible.bottom, bounds.bottom)
          visible.left = Math.max(visible.left, bounds.left)
          visible.right = Math.min(visible.right, bounds.right)
          visible.top = Math.max(visible.top, bounds.top)
        }
        ancestor = ancestor.parentElement
      }

      return (
        laidOut.left >= visible.left - 1 &&
        laidOut.top >= visible.top - 1 &&
        laidOut.left + naturalWidth * scaleX <= visible.right + 1 &&
        laidOut.bottom <= visible.bottom + 1
      )
    },
    await screenshotTarget.elementHandle()
  )

  expect(clipping, 'complete text layout must fit within clipping bounds').toBe(
    true
  )

  const rendered = await screenshotTarget.screenshot({ animations: 'disabled' })
  const inlineColor = await text.evaluate((element) => {
    const htmlElement = element as HTMLElement
    const color = htmlElement.style.color
    htmlElement.style.color = 'transparent'
    return color
  })
  const withoutText = await screenshotTarget
    .screenshot({ animations: 'disabled' })
    .finally(() =>
      text.evaluate((element, color) => {
        ;(element as HTMLElement).style.color = color
      }, inlineColor)
    )

  const ink = await text.page().evaluate(
    async ({ rendered, withoutText }) => {
      const decode = async (base64: string) => {
        const image = new Image()
        image.src = `data:image/png;base64,${base64}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d')!
        context.drawImage(image, 0, 0)
        return context.getImageData(0, 0, image.width, image.height)
      }
      const [visible, hidden] = await Promise.all([
        decode(rendered),
        decode(withoutText)
      ])
      const bounds = {
        left: visible.width,
        top: visible.height,
        right: -1,
        bottom: -1
      }
      let pixels = 0
      for (let index = 0; index < visible.data.length; index += 4) {
        const difference =
          Math.abs(visible.data[index] - hidden.data[index]) +
          Math.abs(visible.data[index + 1] - hidden.data[index + 1]) +
          Math.abs(visible.data[index + 2] - hidden.data[index + 2])
        if (difference < 24) continue
        const pixel = index / 4
        const x = pixel % visible.width
        const y = Math.floor(pixel / visible.width)
        bounds.left = Math.min(bounds.left, x)
        bounds.top = Math.min(bounds.top, y)
        bounds.right = Math.max(bounds.right, x)
        bounds.bottom = Math.max(bounds.bottom, y)
        pixels++
      }
      return { bounds, height: visible.height, pixels, width: visible.width }
    },
    {
      rendered: rendered.toString('base64'),
      withoutText: withoutText.toString('base64')
    }
  )

  expect(ink.pixels).toBeGreaterThan(10)
  expect(ink.bounds.left).toBeGreaterThan(0)
  expect(ink.bounds.top).toBeGreaterThan(0)
  expect(ink.bounds.right).toBeLessThan(ink.width - 1)
  expect(ink.bounds.bottom).toBeLessThan(ink.height - 1)
}

test.describe(
  'ECS migration: renderer toggle and zoom rendering',
  { tag: ['@canvas', '@node', '@widget'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.workflow.loadWorkflow('default')
      await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.canvasOps.resetView()
    })

    test.describe('workflow persistence', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.setupWorkflowsDirectory({})
      })

      test.afterEach(async ({ comfyPage }) => {
        await comfyPage.workflow.setupWorkflowsDirectory({})
      })

      for (const { startInVue, label } of [
        { startInVue: false, label: 'legacy to Vue to legacy' },
        { startInVue: true, label: 'Vue to legacy to Vue' }
      ]) {
        test(`preserves the complete workflow through ${label}`, async ({
          comfyPage,
          comfyMouse
        }) => {
          const nodeCount = await comfyPage.page.evaluate(
            () => window.app!.graph.nodes.length
          )
          expect(nodeCount).toBeGreaterThan(0)

          if (startInVue) {
            await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
            await comfyPage.vueNodes.waitForNodes(nodeCount)
          }

          await comfyPage.settings.setSetting(
            'Comfy.VueNodes.Enabled',
            !startInVue
          )
          if (startInVue) {
            await comfyPage.nextFrame()
            await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
          } else {
            await comfyPage.vueNodes.waitForNodes(nodeCount)
          }

          const kSampler = await comfyPage.nodeOps.getNodeRefById('3')
          const initialPosition =
            await kSampler.getProperty<[number, number]>('pos')
          if (startInVue) {
            await kSampler.dragBy({ x: 120, y: 80 })
            const cfgWidget = await kSampler.getWidgetByName('cfg')
            expect(await cfgWidget.getValue()).not.toBe(7.5)
            await cfgWidget.click()
            await comfyPage.nodeOps.fillLegacyWidgetDialog('7.5')
            await expect.poll(() => cfgWidget.getValue()).toBe(7.5)
          } else {
            const fixture =
              await comfyPage.vueNodes.getFixtureByTitle('KSampler')
            await comfyMouse.dragElementBy(fixture.title, { x: 120, y: 80 })
            const cfgWidget = comfyPage.vueNodes
              .getWidgetByName('KSampler', 'cfg')
              .first()
            const { input } =
              comfyPage.vueNodes.getInputNumberControls(cfgWidget)
            await input.fill('7.5')
            await input.blur()
            await expect(input).toHaveValue('7.5')
          }
          await expect
            .poll(() => kSampler.getProperty<[number, number]>('pos'))
            .not.toEqual(initialPosition)

          const expectedSerialized =
            await comfyPage.nodeOps.getSerializedGraph()

          await comfyPage.settings.setSetting(
            'Comfy.VueNodes.Enabled',
            startInVue
          )
          if (startInVue) {
            await comfyPage.vueNodes.waitForNodes(nodeCount)
          } else {
            await comfyPage.nextFrame()
            await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
          }

          const expectedRuntime = await comfyPage.page.evaluate(() => {
            const graph = window.app!.graph
            return {
              widgetValues: graph.nodes.map((node) => ({
                id: node.id,
                values: node.widgets?.map((widget) => widget.value) ?? []
              })),
              linkEndpoints: [...graph.links.values()].map((link) => ({
                id: link.id,
                originId: link.origin_id,
                originSlot: link.origin_slot,
                targetId: link.target_id,
                targetSlot: link.target_slot
              }))
            }
          })
          expect(await comfyPage.nodeOps.getSerializedGraph()).toEqual(
            expectedSerialized
          )

          await comfyPage.menu.topbar.saveWorkflow(
            `Renderer Round Trip ${label}`
          )
          await comfyPage.workflow.reloadAndWaitForApp()
          if (startInVue) {
            await comfyPage.vueNodes.waitForNodes(nodeCount)
          } else {
            await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
          }

          await expect
            .poll(() =>
              comfyPage.page.evaluate(() => {
                const graph = window.app!.graph
                return {
                  widgetValues: graph.nodes.map((node) => ({
                    id: node.id,
                    values: node.widgets?.map((widget) => widget.value) ?? []
                  })),
                  linkEndpoints: [...graph.links.values()].map((link) => ({
                    id: link.id,
                    originId: link.origin_id,
                    originSlot: link.origin_slot,
                    targetId: link.target_id,
                    targetSlot: link.target_slot
                  }))
                }
              })
            )
            .toEqual(expectedRuntime)
          expect(await comfyPage.nodeOps.getSerializedGraph()).toEqual(
            expectedSerialized
          )
          await expect(comfyPage.toast.toastErrors).toHaveCount(0)
        })
      }
    })

    test('keeps node and link counts stable across three serialized renderer round trips', async ({
      comfyPage
    }) => {
      const initialCounts = await comfyPage.page.evaluate(() => ({
        nodes: window.app!.graph.nodes.length,
        links: window.app!.graph.links.size
      }))

      for (let toggle = 0; toggle < 3; toggle++) {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await comfyPage.vueNodes.waitForNodes(initialCounts.nodes)
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
        await comfyPage.nextFrame()
        await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => ({
              nodes: window.app!.graph.nodes.length,
              links: window.app!.graph.links.size
            }))
          )
          .toEqual(initialCounts)
      }

      await expect(comfyPage.toast.toastErrors).toHaveCount(0)
    })

    for (const { label, scale } of [
      { label: '50%', scale: 0.5 },
      { label: '200%', scale: 2 }
    ]) {
      test(`renders Vue widget labels and titles at ${label} zoom`, async ({
        comfyPage
      }) => {
        await comfyPage.canvasOps.resetView()
        await comfyPage.canvasOps.setScale(scale)
        const kSampler = await comfyPage.nodeOps.getNodeRefById('3')
        await kSampler.centerOnNode()
        await expect
          .poll(() => comfyPage.canvasOps.getScale())
          .toBeCloseTo(scale, 2)

        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await comfyPage.vueNodes.waitForNodes()
        await expect
          .poll(() => comfyPage.canvasOps.getScale())
          .toBeCloseTo(scale, 2)

        const vueNode = comfyPage.vueNodes.getNodeByTitle('KSampler')
        const title = vueNode.getByTestId('node-title')
        await expect(title).toBeVisible()
        await expect(title).toHaveText('KSampler')
        await expectRenderedTextUnclipped(
          title,
          vueNode.getByTestId('node-header-3')
        )

        const cfgWidget = comfyPage.vueNodes
          .getWidgetByName('KSampler', 'cfg')
          .first()
        await expect(cfgWidget).toBeVisible()
        const cfgRow = comfyPage.vueNodes.getWidgetRowByLabel('KSampler', 'cfg')
        await expect(cfgRow).toBeVisible()
        const cfgLabel = cfgRow.getByTestId('widget-layout-field-label')
        await expectRenderedTextUnclipped(cfgLabel, cfgRow)
        if (scale === 2) {
          for (const { container, text } of [
            { container: vueNode.getByTestId('node-header-3'), text: title },
            { container: cfgRow, text: cfgLabel }
          ]) {
            const originalStyle = await text.getAttribute('style')
            await text.evaluate((element) => {
              const htmlElement = element as HTMLElement
              const width = document.createRange()
              width.selectNodeContents(element)
              const scaleX =
                htmlElement.offsetWidth > 0
                  ? htmlElement.getBoundingClientRect().width /
                    htmlElement.offsetWidth
                  : 1
              const halfWidth = `${width.getBoundingClientRect().width / scaleX / 2}px`
              htmlElement.style.width = halfWidth
              htmlElement.style.minWidth = '0'
              htmlElement.style.maxWidth = halfWidth
              htmlElement.style.flex = `0 0 ${halfWidth}`
              htmlElement.style.display = 'inline-block'
              htmlElement.style.position = 'absolute'
              htmlElement.style.overflow = 'hidden'
              htmlElement.style.whiteSpace = 'nowrap'
            })
            await expect(text).toBeVisible()
            await expect(
              expectRenderedTextUnclipped(text, container)
            ).rejects.toThrow(
              'complete text layout must fit within clipping bounds'
            )
            await text.evaluate((element, style) => {
              if (style === null) element.removeAttribute('style')
              else element.setAttribute('style', style)
            }, originalStyle)
            await expectRenderedTextUnclipped(text, container)
          }
        }
        const { input } = comfyPage.vueNodes.getInputNumberControls(cfgWidget)
        await input.fill('7.5')
        await input.blur()
        await expect(input).toHaveValue('7.5')
      })
    }
  }
)
