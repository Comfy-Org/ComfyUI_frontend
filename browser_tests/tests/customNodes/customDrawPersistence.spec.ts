import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { packPersistenceTest as test } from '@e2e/fixtures/customNode/packPersistenceFixture'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'

const expectedSelection = [
  { name: 'A1', selected: true },
  { name: 'A2', selected: false },
  { name: 'B1', selected: false },
  { name: 'B2', selected: true }
]

test.describe(
  'custom-drawn pack widget persistence @custom-nodes',
  { tag: ['@oss', '@node', '@widget', '@vue-nodes'] },
  () => {
    test('rgthree comparer pointer selection survives save and full reload in Nodes 2.0', async ({
      comfyPage,
      savedWorkflows
    }, testInfo) => {
      test.setTimeout(60_000)
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.workflow.setupWorkflowsDirectory({})
      await comfyPage.workflow.reloadAndWaitForApp()
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await comfyPage.workflow.waitForWorkflowIdle()
      await comfyPage.nodeOps.clearGraph()

      const workflowName = `actual-rgthree-custom-draw-${crypto.randomUUID()}`
      savedWorkflows.track(workflowName)
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => ({
            extension: window.app!.extensions.some(
              ({ name }) => name === 'rgthree.ImageComparer'
            ),
            widget: window.LiteGraph!.createNode('Image Comparer (rgthree)')
              ?.widgets?.[0]?.name
          }))
        )
        .toEqual({ extension: true, widget: 'rgthree_comparer' })
      const nodeId = await comfyPage.page.evaluate(() => {
        const comparer = window.LiteGraph!.createNode(
          'Image Comparer (rgthree)'
        )!
        window.app!.graph.add(comparer)
        comparer.pos = [100, 100]
        comparer.size = [420, 300]
        comparer.widgets![0].value = {
          images: [
            {
              name: 'A1',
              selected: true,
              url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32"%3E%3Crect width="32" height="32" fill="red"/%3E%3C/svg%3E'
            },
            {
              name: 'A2',
              selected: false,
              url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32"%3E%3Crect width="32" height="32" fill="green"/%3E%3C/svg%3E'
            },
            {
              name: 'B1',
              selected: true,
              url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32"%3E%3Crect width="32" height="32" fill="blue"/%3E%3C/svg%3E'
            },
            {
              name: 'B2',
              selected: false,
              url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="32" height="32"%3E%3Crect width="32" height="32" fill="yellow"/%3E%3C/svg%3E'
            }
          ]
        }
        window.app!.canvas.centerOnNode(comparer)
        comparer.setDirtyCanvas(true, true)
        return String(comparer.id)
      })

      const canvas = comfyPage.vueNodes.getNodeLocator(nodeId).locator('canvas')
      await expect(canvas).toBeVisible()
      await expect
        .poll(() =>
          comfyPage.page.evaluate((id) => {
            const node = window.app!.graph.nodes.find(
              (candidate) => String(candidate.id) === id
            )!
            const widget = node.widgets![0]
            if (
              !('hitAreas' in widget) ||
              typeof widget.hitAreas !== 'object' ||
              widget.hitAreas === null
            )
              throw new Error('rgthree comparer hit areas are unavailable')
            return {
              hitAreaNames: Object.keys(widget.hitAreas),
              imagesReady: node.imgs?.every((image) => image.complete)
            }
          }, nodeId)
        )
        .toEqual({
          hitAreaNames: ['A1', 'A2', 'B1', 'B2'],
          imagesReady: true
        })

      const b2 = await comfyPage.page.evaluate((id) => {
        const node = window.app!.graph.nodes.find(
          (candidate) => String(candidate.id) === id
        )!
        const widget = node.widgets![0]
        const hitAreas = Reflect.get(widget, 'hitAreas')
        if (typeof hitAreas !== 'object' || hitAreas === null)
          throw new Error('rgthree comparer hit areas are unavailable')
        const b2HitArea = Reflect.get(hitAreas, 'B2')
        if (typeof b2HitArea !== 'object' || b2HitArea === null)
          throw new Error('B2 hit area is unavailable')
        const bounds = Reflect.get(b2HitArea, 'bounds')
        if (!Array.isArray(bounds) || !bounds.every(Number.isFinite))
          throw new Error('B2 hit area bounds are invalid')
        const [x, y, width, height] = bounds
        return [x, y, width, height]
      }, nodeId)
      await canvas.click({
        position: { x: b2[0] + b2[2] / 2, y: b2[1] + b2[3] / 2 }
      })

      const selection = () =>
        comfyPage.page.evaluate((id) => {
          const node = window.app!.graph.nodes.find(
            (candidate) => String(candidate.id) === id
          )!
          const value = node.widgets![0].value
          if (
            typeof value !== 'object' ||
            value === null ||
            !('images' in value) ||
            !Array.isArray(value.images)
          )
            throw new Error('rgthree comparer value is unavailable')
          return value.images.map((image: unknown) => {
            if (
              typeof image !== 'object' ||
              image === null ||
              !('name' in image) ||
              !('selected' in image)
            )
              throw new Error('rgthree comparer image state is invalid')
            return { name: image.name, selected: image.selected }
          })
        }, nodeId)
      await expect.poll(selection).toEqual(expectedSelection)
      await canvas.hover({ position: { x: 315, y: 150 } })
      await comfyPage.page.evaluate((id) => {
        window
          .app!.graph.nodes.find((candidate) => String(candidate.id) === id)!
          .setDirtyCanvas(true, true)
      }, nodeId)
      await comfyPage.nextFrame()

      const beforeReload = testInfo.outputPath(
        'rgthree-custom-draw-selected.png'
      )
      await canvas.screenshot({ path: beforeReload })
      await testInfo.attach('rgthree custom draw after pointer selection', {
        path: beforeReload,
        contentType: 'image/png'
      })

      await comfyPage.menu.topbar.saveWorkflow(workflowName)
      await comfyPage.workflow.reloadAndWaitForApp()
      await openWorkflowFromSidebar(comfyPage, workflowName)
      await expect
        .poll(selection, { timeout: 15_000 })
        .toEqual(expectedSelection)

      const reloadedCanvas = comfyPage.vueNodes
        .getNodeLocator(nodeId)
        .locator('canvas')
      await expect(reloadedCanvas).toBeVisible()
      await expect
        .poll(() =>
          reloadedCanvas.evaluate((canvas: HTMLCanvasElement) => {
            const context = canvas.getContext('2d')
            if (!context) throw new Error('rgthree comparer canvas is not 2D')
            const pixels = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            ).data
            let red = 0
            for (let index = 0; index < pixels.length; index += 4) {
              if (
                pixels[index] > 200 &&
                pixels[index + 1] < 80 &&
                pixels[index + 2] < 80
              )
                red++
            }
            return red
          })
        )
        .toBeGreaterThan(100)
      await reloadedCanvas.hover({ position: { x: 315, y: 150 } })
      await comfyPage.nextFrame()
      const afterReload = testInfo.outputPath(
        'rgthree-custom-draw-reloaded.png'
      )
      await reloadedCanvas.screenshot({ path: afterReload })
      await testInfo.attach('rgthree custom draw after full reload', {
        path: afterReload,
        contentType: 'image/png'
      })
      await expect(comfyPage.toast.toastErrors).toHaveCount(0)
    })
  }
)
