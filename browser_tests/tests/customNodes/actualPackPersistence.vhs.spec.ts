import { readFile } from 'node:fs/promises'

import type { Response } from '@playwright/test'

import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { packPersistenceTest as test } from '@e2e/fixtures/customNode/packPersistenceFixture'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'
import { hasInstalledPack } from '@e2e/fixtures/utils/customNodeSuite'
import { assetPath } from '@e2e/fixtures/utils/paths'

test.describe(
  'actual custom-pack persistence @custom-nodes',
  { tag: ['@oss', '@node', '@widget'] },
  () => {
    if (!hasInstalledPack('ComfyUI-VideoHelperSuite')) return

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.page.goto('about:blank')
    })

    test('VHS format-dependent widgets survive graph.configure()', async ({
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
        async (
          { comfyFiles, comfyPage, packPersistence, savedWorkflows },
          testInfo
        ) => {
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
          const previews = new Map<string, Response>()
          comfyPage.page.on('response', (response) => {
            const url = new URL(response.url())
            if (
              url.pathname.endsWith('/vhs/viewvideo') &&
              url.searchParams.get('filename') === videoName
            ) {
              previews.set(response.url(), response)
            }
          })
          comfyFiles.deleteAfterTest({
            filename: videoName,
            type: 'input'
          })
          const upload = await comfyPage.request.post(
            `${comfyPage.apiUrl}/upload/image`,
            {
              multipart: {
                image: {
                  name: videoName,
                  mimeType: 'video/mp4',
                  // Generated with ffmpeg from testsrc2 (32x32, 2 fps, 1s) and a 440 Hz sine (8 kHz, 1s), encoded as H.264/AAC.
                  buffer: await readFile(assetPath('vhs_video_with_audio.mp4'))
                },
                type: 'input',
                overwrite: 'true'
              }
            }
          )
          expect(
            upload.ok(),
            `VHS fixture upload failed (${upload.status()}): ${await upload.text()}`
          ).toBe(true)
          await comfyPage.page.evaluate(
            ({ loadId, videoName }) => {
              const load = window.app!.graph.nodes.find(
                (node) => String(node.id) === loadId
              )!
              const video = load.widgets!.find(
                (widget) => widget.name === 'video'
              )!
              if (!Array.isArray(video.options.values)) {
                throw new Error(
                  'VHS video widget options.values is not an array'
                )
              }
              video.options.values = [...video.options.values, videoName]
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

          const setFormat = async (value: string) => {
            if (useVueNodes) {
              await comfyPage.vueNodes.selectComboOption(
                'Video Combine 🎥🅥🅗🅢',
                'format',
                value
              )
              return
            }

            const combineNode = await comfyPage.nodeOps.getNodeRefById(
              ids.combine
            )
            await (await combineNode.getWidgetByName('format')).click()
            await comfyPage.contextMenu.clickLitegraphMenuItem(value)
            await comfyPage.nextFrame()
          }

          const legacyLabelPixelDifference = (label: string) =>
            comfyPage.page.evaluate(
              async ({ combineId, label }) => {
                const canvas =
                  document.querySelector<HTMLCanvasElement>('#graph-canvas')!
                const context = canvas.getContext('2d')!
                const node = window.app!.graph.nodes.find(
                  (candidate) => String(candidate.id) === combineId
                )!
                const original = CanvasRenderingContext2D.prototype.fillText
                const crops: {
                  x: number
                  y: number
                  width: number
                  height: number
                }[] = []
                const paint = () =>
                  new Promise<void>((resolve) => {
                    node.setDirtyCanvas(true, true)
                    requestAnimationFrame(() =>
                      requestAnimationFrame(() => resolve())
                    )
                  })

                try {
                  CanvasRenderingContext2D.prototype.fillText = function (
                    text,
                    x,
                    y,
                    maxWidth
                  ) {
                    if (this.canvas === canvas && text === label) {
                      const metrics = this.measureText(text)
                      const transform = this.getTransform()
                      const left = transform.a * x + transform.e - 4
                      const baseline = transform.d * y + transform.f
                      const ascent =
                        metrics.actualBoundingBoxAscent * transform.d + 4
                      const descent =
                        metrics.actualBoundingBoxDescent * transform.d + 4
                      crops.push({
                        x: Math.max(0, Math.floor(left)),
                        y: Math.max(0, Math.floor(baseline - ascent)),
                        width: Math.min(
                          canvas.width - Math.max(0, Math.floor(left)),
                          Math.ceil(metrics.width * transform.a + 8)
                        ),
                        height: Math.min(
                          canvas.height -
                            Math.max(0, Math.floor(baseline - ascent)),
                          Math.ceil(ascent + descent)
                        )
                      })
                    }
                    if (maxWidth === undefined) original.call(this, text, x, y)
                    else original.call(this, text, x, y, maxWidth)
                  }
                  await paint()
                } finally {
                  CanvasRenderingContext2D.prototype.fillText = original
                }

                const targetCrop = crops.at(-1)
                if (targetCrop === undefined) {
                  return { drawCalls: 0, changedPixels: 0 }
                }
                const visible = context.getImageData(
                  targetCrop.x,
                  targetCrop.y,
                  targetCrop.width,
                  targetCrop.height
                )
                let drawCalls = 0
                try {
                  CanvasRenderingContext2D.prototype.fillText = function (
                    text,
                    x,
                    y,
                    maxWidth
                  ) {
                    if (this.canvas === canvas && text === label) {
                      drawCalls++
                      return
                    }
                    if (maxWidth === undefined) original.call(this, text, x, y)
                    else original.call(this, text, x, y, maxWidth)
                  }
                  await paint()
                  const suppressed = context.getImageData(
                    targetCrop.x,
                    targetCrop.y,
                    targetCrop.width,
                    targetCrop.height
                  )
                  let changedPixels = 0
                  for (let index = 0; index < visible.data.length; index += 4) {
                    const difference =
                      Math.abs(visible.data[index] - suppressed.data[index]) +
                      Math.abs(
                        visible.data[index + 1] - suppressed.data[index + 1]
                      ) +
                      Math.abs(
                        visible.data[index + 2] - suppressed.data[index + 2]
                      )
                    if (difference >= 24) changedPixels++
                  }
                  return { drawCalls, changedPixels }
                } finally {
                  CanvasRenderingContext2D.prototype.fillText = original
                  await paint()
                }
              },
              { combineId: ids.combine, label }
            )

          const attachLegacyControls = async (name: string) => {
            const clip = await comfyPage.page.evaluate((combineId) => {
              const node = window.app!.graph.nodes.find(
                (candidate) => String(candidate.id) === combineId
              )!
              const topLeft = window.app!.canvasPosToClientPos([
                node.pos[0],
                node.pos[1] + window.LiteGraph!['NODE_TITLE_HEIGHT']
              ])
              const bottomRight = window.app!.canvasPosToClientPos([
                node.pos[0] + node.size[0],
                node.pos[1] + node.size[1]
              ])
              return {
                x: topLeft[0],
                y: topLeft[1],
                width: bottomRight[0] - topLeft[0],
                height: bottomRight[1] - topLeft[1]
              }
            }, ids.combine)
            const path = testInfo.outputPath(`${name}.png`)
            await comfyPage.page.screenshot({ clip, path })
            await testInfo.attach(name, { path, contentType: 'image/png' })
          }

          const controls = () =>
            comfyPage.page.evaluate((combineId) => {
              const node = window.app!.graph.nodes.find(
                (candidate) => String(candidate.id) === combineId
              )!
              return node.widgets!.map((widget) => widget.label ?? widget.name)
            }, ids.combine)

          await setFormat('video/h264-mp4')
          await expect
            .poll(controls)
            .toEqual(
              expect.arrayContaining(['pix_fmt', 'crf', 'save_metadata'])
            )
          if (useVueNodes) {
            const node = comfyPage.vueNodes.getNodeLocator(ids.combine)
            for (const label of ['pix_fmt', 'crf', 'save_metadata']) {
              await expect(node.getByText(label, { exact: true })).toBeVisible()
            }
          } else {
            for (const label of ['pix_fmt', 'crf', 'save_metadata']) {
              const pixels = await legacyLabelPixelDifference(label)
              expect(pixels.drawCalls).toBeGreaterThan(0)
              expect(pixels.changedPixels).toBeGreaterThan(10)
            }
            await attachLegacyControls('legacy-video-controls-present')
          }

          await setFormat('image/gif')
          await expect.poll(controls).not.toContain('pix_fmt')
          await expect.poll(controls).not.toContain('crf')
          await expect.poll(controls).not.toContain('save_metadata')

          if (useVueNodes) {
            const node = comfyPage.vueNodes.getNodeLocator(ids.combine)
            for (const label of ['pix_fmt', 'crf', 'save_metadata']) {
              await expect(node.getByText(label, { exact: true })).toBeHidden()
            }
            await expect
              .poll(() =>
                comfyPage.page.evaluate(
                  (combineId) =>
                    window
                      .app!.graph.nodes.find(
                        (candidate) => String(candidate.id) === combineId
                      )
                      ?.widgets?.find((widget) => widget.name === 'format')
                      ?.value,
                  ids.combine
                )
              )
              .toBe('image/gif')
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
            for (const label of ['pix_fmt', 'crf', 'save_metadata']) {
              await expect
                .poll(() => legacyLabelPixelDifference(label))
                .toEqual({ drawCalls: 0, changedPixels: 0 })
            }
            const formatPixels = await legacyLabelPixelDifference('format')
            expect(formatPixels.drawCalls).toBeGreaterThan(0)
            expect(formatPixels.changedPixels).toBeGreaterThan(10)
            await attachLegacyControls('legacy-video-controls-absent')
          }

          await setFormat('video/h264-mp4')

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

          const workflowName = `vhs-persistence-${crypto.randomUUID()}`
          savedWorkflows.track(workflowName)
          await comfyPage.menu.topbar.saveWorkflow(workflowName)
          await comfyPage.workflow.reloadAndWaitForApp()
          await openWorkflowFromSidebar(comfyPage, workflowName)

          await expect
            .poll(() => packPersistence.projectInputLinks(ids.combine))
            .toEqual([[ids.load, 0, ids.combine, 0]])
          await expect
            .poll(() =>
              comfyPage.page.evaluate(({ load, combine }) => {
                const nodes = window.app!.graph.nodes
                return [load, combine].map((id) => {
                  const node = nodes.find((node) => String(node.id) === id)
                  return {
                    type: node?.type,
                    widgets: Object.fromEntries(
                      (node?.widgets ?? [])
                        .filter(
                          ({ name }) =>
                            name === (id === load ? 'video' : 'format')
                        )
                        .map(({ name, value }) => [name, value])
                    )
                  }
                })
              }, ids)
            )
            .toEqual([
              { type: 'VHS_LoadVideo', widgets: { video: videoName } },
              {
                type: 'VHS_VideoCombine',
                widgets: { format: 'video/h264-mp4' }
              }
            ])
          const video = comfyPage.page.locator(`video[src*="${videoName}"]`)
          await expect(video).toHaveJSProperty('readyState', 4)
          const src = await video.getAttribute('src')
          const preview = previews.get(new URL(src!, comfyPage.url).href)
          expect(preview).toBeDefined()
          expect(preview!.ok()).toBe(true)
          expect(await preview!.finished()).toBeNull()
        }
      )
    }
  }
)
