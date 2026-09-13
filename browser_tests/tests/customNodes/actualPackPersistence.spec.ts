import { readFile } from 'node:fs/promises'

import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { packPersistenceTest as test } from '@e2e/fixtures/customNode/packPersistenceFixture'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'
import { assetPath } from '@e2e/fixtures/utils/paths'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

test.describe(
  'actual custom-pack persistence @custom-nodes',
  { tag: ['@oss', '@node', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('VHS format-dependent widgets survive graph reload', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
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

    for (const renderer of [
      { name: 'legacy', tags: [] },
      { name: 'Vue', tags: ['@vue-nodes'] }
    ]) {
      test(
        `VHS uploads and combines a real video with format controls (${renderer.name} renderer)`,
        { tag: renderer.tags },
        async ({ comfyPage, packPersistence }) => {
          test.slow()
          const useVueNodes = renderer.name === 'Vue'
          await comfyPage.settings.setSetting(
            'Comfy.VueNodes.Enabled',
            useVueNodes
          )
          await comfyPage.workflow.reloadAndWaitForApp()
          await comfyPage.nodeOps.clearGraph()

          const ids = await comfyPage.page.evaluate(() => {
            const graph = window.app!.graph
            const load = window.LiteGraph!.createNode('VHS_LoadVideo')!
            const combine = window.LiteGraph!.createNode('VHS_VideoCombine')!
            graph.add(load)
            graph.add(combine)
            load.pos = [0, 0]
            combine.pos = [520, 0]
            load.connect(0, combine, 0)
            return { combine: String(combine.id), load: String(load.id) }
          })

          const videoName = `vhs-controls-${crypto.randomUUID()}.mp4`
          const upload = await comfyPage.request.post(
            `${comfyPage.apiUrl}/upload/image`,
            {
              multipart: {
                image: {
                  name: videoName,
                  mimeType: 'video/mp4',
                  buffer: await readFile(assetPath('plain_video.mp4'))
                },
                type: 'input',
                overwrite: 'true'
              }
            }
          )
          expect(upload.ok()).toBe(true)
          await comfyPage.page.evaluate(
            ({ loadId, videoName }) => {
              const load = window.app!.graph.nodes.find(
                (node) => String(node.id) === loadId
              )!
              const video = load.widgets!.find(
                (widget) => widget.name === 'video'
              )!
              video.options.values = [
                ...(video.options.values as string[]),
                videoName
              ]
              video.value = videoName
              video.callback?.(videoName)
            },
            { loadId: ids.load, videoName }
          )
          await expect
            .poll(() =>
              comfyPage.page.evaluate(
                (loadId) =>
                  window
                    .app!.graph.nodes.find((node) => String(node.id) === loadId)
                    ?.widgets?.find((widget) => widget.name === 'video')?.value,
                ids.load
              )
            )
            .toBe(videoName)

          const setFormat = async (value: string) =>
            comfyPage.page.evaluate(
              ({ combineId, value }) => {
                const node = window.app!.graph.nodes.find(
                  (candidate) => String(candidate.id) === combineId
                )!
                const format = node.widgets!.find(
                  (widget) => widget.name === 'format'
                )!
                format.value = value
                format.callback?.(value)
                node.setDirtyCanvas(true, true)
              },
              { combineId: ids.combine, value }
            )

          const controls = () =>
            comfyPage.page.evaluate((combineId) => {
              const node = window.app!.graph.nodes.find(
                (candidate) => String(candidate.id) === combineId
              )!
              return node.widgets!.map((widget) => widget.label ?? widget.name)
            }, ids.combine)

          await setFormat('video/h264-mp4')
          let controlsError: unknown
          await expect
            .poll(controls)
            .toEqual(
              expect.arrayContaining(['pix_fmt', 'crf', 'save_metadata'])
            )
            .catch((error: unknown) => {
              controlsError = error
            })

          if (controlsError === undefined) {
            await setFormat('image/gif')
            await expect
              .poll(controls)
              .not.toEqual(
                expect.arrayContaining(['pix_fmt', 'crf', 'save_metadata'])
              )
            await setFormat('video/h264-mp4')
          } else {
            await setFormat('image/gif')
          }

          if (useVueNodes && controlsError === undefined) {
            const node = comfyPage.vueNodes.getNodeLocator(ids.combine)
            for (const label of ['pix_fmt', 'crf', 'save_metadata']) {
              await expect(node.getByText(label, { exact: true })).toBeVisible()
            }
          } else {
            await comfyPage.page.evaluate((combineId) => {
              const node = window.app!.graph.nodes.find(
                (candidate) => String(candidate.id) === combineId
              )!
              window.app!.canvas.centerOnNode(node)
              node.setDirtyCanvas(true, true)
            }, ids.combine)
            await comfyPage.nextFrame()
            await expect(comfyPage.page.locator('#graph-canvas')).toBeVisible()
          }

          const result = await packPersistence.target.runWorkflow(
            comfyPage.page,
            {
              expectedNodeIds: [ids.combine],
              graphNodeIds: [ids.load, ids.combine],
              timeoutMs: 30_000
            }
          )
          expect(result.outcome).toBe('PASS')
          expect(result.executedNodes).toEqual(
            expect.arrayContaining([ids.load, ids.combine])
          )
          if (controlsError !== undefined) {
            expect(controlsError).toMatchObject({
              matcherResult: { name: 'toEqual', pass: false }
            })
            test.fail(
              true,
              'VHS format callback does not expose its labelled controls after app reload'
            )
            throw controlsError
          }
        }
      )

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
          const savedWorkflow = saveRequest.postDataJSON() as ComfyWorkflowJSON
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
