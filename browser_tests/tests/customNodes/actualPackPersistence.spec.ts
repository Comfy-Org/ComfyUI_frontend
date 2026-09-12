import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { LocalDesktopTarget } from '@e2e/fixtures/customNode/ComfyTarget'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'

const target = new LocalDesktopTarget()

test.describe(
  'actual custom-pack persistence @custom-nodes',
  { tag: ['@oss', '@node', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.canvasOps.resetView()
    })

    test('VHS format-dependent widgets survive graph reload', async ({
      comfyPage
    }) => {
      const before = await comfyPage.page.evaluate(() => {
        const graph = window.app!.graph
        const video = window.LiteGraph!.createNode('VHS_VideoCombine')!
        graph.add(video)
        const format = video.widgets!.find(
          (widget) => widget.name === 'format'
        )!
        format.value = 'video/h264-mp4'
        format.callback?.('video/h264-mp4')
        const names = video.widgets!.map((widget) => widget.name)
        return { workflow: graph.serialize(), nodeId: video.id, names }
      })

      expect(before.names).toEqual(
        expect.arrayContaining(['format', 'pix_fmt', 'crf', 'save_metadata'])
      )
      await comfyPage.page.evaluate((workflow) => {
        window.app!.graph.configure(workflow)
      }, before.workflow)

      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            (nodeId) =>
              window
                .app!.graph.getNodeById(nodeId)!
                .widgets!.map((widget) => widget.name),
            before.nodeId
          )
        )
        .toEqual(before.names)
    })

    test('rgthree comparer receives two real backend images and retains them through a tab switch', async ({
      comfyPage
    }) => {
      test.slow()
      await comfyPage.workflow.setupWorkflowsDirectory({})
      for (const vueNodesEnabled of [false, true] as const) {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await comfyPage.page.reload({ waitUntil: 'domcontentloaded' })
        await comfyPage.waitForAppReady()
        await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
        await comfyPage.workflow.waitForWorkflowIdle()
        await comfyPage.nodeOps.clearGraph()

        const workflowName = await comfyPage.page.evaluate(
          (renderer) =>
            `actual-rgthree-comparer-${renderer}-${crypto.randomUUID()}`,
          vueNodesEnabled ? 'vue' : 'legacy'
        )
        const ids = await comfyPage.page.evaluate(() => {
          const graph = window.app!.graph
          const first = window.LiteGraph!.createNode('EmptyImage')!
          const second = window.LiteGraph!.createNode('EmptyImage')!
          const comparer = window.LiteGraph!.createNode(
            'Image Comparer (rgthree)'
          )!
          first.widgets!.find((widget) => widget.name === 'color')!.value =
            0xff0000
          second.widgets!.find((widget) => widget.name === 'color')!.value =
            0x0000ff
          graph.add(first)
          graph.add(second)
          graph.add(comparer)
          first.connect(0, comparer, 0)
          second.connect(0, comparer, 1)
          return {
            expectedIds: [
              String(first.id),
              String(second.id),
              String(comparer.id)
            ],
            comparerId: String(comparer.id)
          }
        })

        const result = await target.runWorkflow(comfyPage.page, {
          expectedNodeIds: [ids.comparerId],
          graphNodeIds: ids.expectedIds,
          timeoutMs: 15_000
        })
        expect(result.outcome).toBe('PASS')

        const comparerState = () =>
          comfyPage.page.evaluate((nodeId) => {
            const graph = window.app?.graph
            const node = graph?.nodes.find(
              (candidate) => String(candidate.id) === nodeId
            )
            if (!node) return undefined
            const value = node.widgets?.[0]?.value
            const renderedImages = node.imgs?.map((image) => ({
              complete: image.complete,
              naturalHeight: image.naturalHeight,
              naturalWidth: image.naturalWidth,
              src: image.src
            }))
            return { renderedImages, value }
          }, ids.comparerId)

        const expectedComparison = {
          renderedImages: [
            expect.objectContaining({
              complete: true,
              naturalHeight: 512,
              naturalWidth: 512
            }),
            expect.objectContaining({
              complete: true,
              naturalHeight: 512,
              naturalWidth: 512
            })
          ],
          value: {
            images: [
              expect.objectContaining({ name: 'A', selected: true }),
              expect.objectContaining({ name: 'B', selected: true })
            ]
          }
        }
        await expect.poll(comparerState).toEqual(expectedComparison)
        const initialState = await comparerState()
        expect(initialState?.renderedImages?.[0].src).not.toBe(
          initialState?.renderedImages?.[1].src
        )

        await comfyPage.menu.topbar.saveWorkflow(workflowName)
        await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
        await comfyPage.workflow.waitForWorkflowIdle()
        await comfyPage.menu.topbar.workflowTabs
          .getByText(workflowName, { exact: true })
          .click()
        await comfyPage.page.keyboard.press('Escape')
        await comfyPage.workflow.waitForWorkflowIdle()
        await expect.poll(comparerState).toEqual(expectedComparison)

        await comfyPage.command.executeCommand('Comfy.SaveWorkflow')
        await comfyPage.workflow.waitForWorkflowIdle()
        await expect(comfyPage.toast.toastErrors).toHaveCount(0)

        await comfyPage.page.reload({ waitUntil: 'domcontentloaded' })
        await comfyPage.waitForAppReady()
        await openWorkflowFromSidebar(comfyPage, workflowName)
        await expect.poll(comparerState).toEqual(expectedComparison)
        const reloadedState = await comparerState()
        expect(reloadedState?.renderedImages?.map(({ src }) => src)).toEqual(
          initialState?.renderedImages?.map(({ src }) => src)
        )
      }
    })
  }
)
