import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { packPersistenceTest as test } from '@e2e/fixtures/customNode/packPersistenceFixture'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'
import { hasInstalledPack } from '@e2e/fixtures/utils/customNodeSuite'

import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

test.describe(
  'actual custom-pack persistence @custom-nodes',
  { tag: ['@oss', '@node', '@widget'] },
  () => {
    if (!hasInstalledPack('rgthree-comfy')) return

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    for (const renderer of [
      { name: 'legacy', tags: [] },
      { name: 'Vue', tags: ['@vue-nodes'] }
    ]) {
      test(
        `rgthree comparer receives two real backend images and retains them through a tab switch (${renderer.name} renderer)`,
        { tag: renderer.tags },
        async ({ comfyPage, packPersistence, savedWorkflows }, testInfo) => {
          test.slow()
          const useVueNodes = renderer.name === 'Vue'
          await comfyPage.settings.setSetting(
            'Comfy.VueNodes.Enabled',
            useVueNodes
          )
          await comfyPage.workflow.setupWorkflowsDirectory({})
          await comfyPage.workflow.reloadAndWaitForApp()
          await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
          await comfyPage.workflow.waitForWorkflowIdle()
          await comfyPage.nodeOps.clearGraph()

          const extensionSetup = await comfyPage.page.evaluate(async () => {
            const response = await fetch('/api/extensions')
            const extensions: unknown = await response.json()
            const comparer = window.LiteGraph!.createNode(
              'Image Comparer (rgthree)'
            )
            return {
              comparerWidgetRegistered: Boolean(
                comparer?.widgets?.some(
                  (widget) => widget.name === 'rgthree_comparer'
                )
              ),
              rgthreeExtensionServed:
                Array.isArray(extensions) &&
                extensions.some(
                  (extension) =>
                    typeof extension === 'string' &&
                    extension.includes('/rgthree-comfy/image_comparer.js')
                )
            }
          })
          expect(extensionSetup).toEqual({
            comparerWidgetRegistered: true,
            rgthreeExtensionServed: true
          })

          const workflowName = await comfyPage.page.evaluate(
            (renderer) =>
              `actual-rgthree-comparer-${renderer}-${crypto.randomUUID()}`,
            renderer.name.toLowerCase()
          )
          savedWorkflows.track(workflowName)
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
            first.pos = [0, 0]
            second.pos = [0, 600]
            comparer.pos = [500, 100]
            comparer.size = [512, 512]
            first.connect(0, comparer, 0)
            second.connect(0, comparer, 1)
            comparer.setDirtyCanvas(true, true)
            return {
              expectedIds: [
                String(first.id),
                String(second.id),
                String(comparer.id)
              ],
              comparerId: String(comparer.id)
            }
          })

          await test.step('execute comparer workflow', async () => {
            const result = await packPersistence.target.runWorkflow(
              comfyPage.page,
              {
                expectedNodeIds: [ids.comparerId],
                graphNodeIds: ids.expectedIds,
                timeoutMs: 15_000
              }
            )
            expect(result.outcome).toBe('PASS')
          })

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

          const initialState =
            await test.step('verify initial comparer rendering', async () => {
              await expect.poll(comparerState).toEqual(expectedComparison)
              const state = await comparerState()
              expect(state?.renderedImages?.[0].src).not.toBe(
                state?.renderedImages?.[1].src
              )
              return state
            })

          const expectVisibleComparison = async (stage: string) => {
            await comfyPage.page.evaluate((nodeId) => {
              const node = window.app!.graph.nodes.find(
                (candidate) => String(candidate.id) === nodeId
              )!
              window.app!.canvas.centerOnNode(node)
              node.setDirtyCanvas(true, true)
            }, ids.comparerId)
            await comfyPage.nextFrame()

            const vueCanvas = comfyPage.vueNodes
              .getNodeLocator(ids.comparerId)
              .locator('canvas')
            const screenshotPath = testInfo.outputPath(
              `rgthree-comparer-${renderer.name.toLowerCase()}-${stage}.png`
            )
            let screenshot: Buffer
            if (useVueNodes) {
              await expect(vueCanvas).toBeVisible()
              await vueCanvas.hover()
              await comfyPage.page.evaluate((nodeId) => {
                window
                  .app!.graph.nodes.find((node) => String(node.id) === nodeId)!
                  .setDirtyCanvas(true, true)
              }, ids.comparerId)
              await comfyPage.nextFrame()
              screenshot = await vueCanvas.screenshot({ path: screenshotPath })
            } else {
              await expect(vueCanvas).toBeHidden()
              const bounds = await comfyPage.page.evaluate((nodeId) => {
                const node = window.app!.graph.nodes.find(
                  (candidate) => String(candidate.id) === nodeId
                )!
                const [x, y] = window.app!.canvasPosToClientPos(node.pos)
                const [right, bottom] = window.app!.canvasPosToClientPos([
                  node.pos[0] + node.size[0],
                  node.pos[1] + node.size[1]
                ])
                return { x, y, width: right - x, height: bottom - y }
              }, ids.comparerId)
              await comfyPage.page.mouse.move(
                bounds.x + bounds.width / 2,
                bounds.y + bounds.height / 2
              )
              await comfyPage.nextFrame()
              screenshot = await comfyPage.page.screenshot({
                clip: bounds,
                path: screenshotPath
              })
            }

            const visiblePixels = await comfyPage.page.evaluate(
              async (base64) => {
                const image = new Image()
                image.src = `data:image/png;base64,${base64}`
                await image.decode()
                const canvas = document.createElement('canvas')
                canvas.width = image.naturalWidth
                canvas.height = image.naturalHeight
                const context = canvas.getContext('2d')!
                context.drawImage(image, 0, 0)
                const pixels = context.getImageData(
                  0,
                  0,
                  canvas.width,
                  canvas.height
                ).data
                let red = 0
                let blue = 0
                for (let index = 0; index < pixels.length; index += 4) {
                  if (pixels[index] > 200 && pixels[index + 2] < 50) red++
                  if (pixels[index] < 50 && pixels[index + 2] > 200) blue++
                }
                return { blue, red }
              },
              screenshot.toString('base64')
            )
            expect(visiblePixels.red).toBeGreaterThan(1_000)
            expect(visiblePixels.blue).toBeGreaterThan(1_000)

            await testInfo.attach(`comparer ${renderer.name} ${stage}`, {
              path: screenshotPath,
              contentType: 'image/png'
            })
          }
          await expectVisibleComparison('queued')

          await test.step('save and restore from workflow tab', async () => {
            await comfyPage.menu.topbar.saveWorkflow(workflowName)
            await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
            await comfyPage.workflow.waitForWorkflowIdle()
            await comfyPage.workflow.switchToTab(workflowName)
            await expect
              .poll(comparerState, { timeout: 15_000 })
              .toEqual(expectedComparison)
          })

          const [saveRequest] = await Promise.all([
            comfyPage.page.waitForRequest(
              (request) =>
                request.method() === 'POST' &&
                request.url().includes('/userdata/') &&
                request.url().includes(encodeURIComponent(workflowName))
            ),
            comfyPage.command.executeCommand('Comfy.SaveWorkflow')
          ])
          await comfyPage.workflow.waitForWorkflowIdle()
          const savedWorkflow = zComfyWorkflow.parse(saveRequest.postDataJSON())
          expect(savedWorkflow.nodes).toHaveLength(3)
          expect(
            savedWorkflow.nodes.find(
              (node) => node.type === 'Image Comparer (rgthree)'
            )?.widgets_values
          ).toEqual([
            [
              expect.objectContaining({ name: 'A', selected: true }),
              expect.objectContaining({ name: 'B', selected: true })
            ]
          ])
          await expect(comfyPage.toast.toastErrors).toHaveCount(0)

          await test.step('full reload preserves comparer state', async () => {
            await comfyPage.workflow.reloadAndWaitForApp()
            await openWorkflowFromSidebar(comfyPage, workflowName)
            await expect
              .poll(comparerState, { timeout: 15_000 })
              .toEqual(expectedComparison)
            const reloadedState = await comparerState()
            expect(
              reloadedState?.renderedImages?.map(({ src }) => src)
            ).toEqual(initialState?.renderedImages?.map(({ src }) => src))
            await expectVisibleComparison('reloaded')
          })
        }
      )
    }
  }
)
