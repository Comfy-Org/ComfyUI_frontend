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

    for (const vueNodesEnabled of [false, true])
      test(`EasyUse seed controls and owned link survive a full reload (${vueNodesEnabled ? 'Vue' : 'legacy'} renderer)`, async ({
        comfyPage,
        packPersistence,
        savedWorkflows
      }) => {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await comfyPage.workflow.setupWorkflowsDirectory({})
        await comfyPage.workflow.reloadAndWaitForApp()
        await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
        await comfyPage.workflow.waitForWorkflowIdle()
        await comfyPage.nodeOps.clearGraph()

        const workflowName = `actual-easyuse-seed-${vueNodesEnabled ? 'vue' : 'legacy'}-${crypto.randomUUID()}`
        savedWorkflows.track(workflowName)
        const ids = await comfyPage.page.evaluate(() => {
          const graph = window.app!.graph
          const seed = window.LiteGraph!.createNode('easy seed')!
          const list = window.LiteGraph!.createNode('easy seedList')!
          const global = window.LiteGraph!.createNode('easy globalSeed')!
          graph.add(seed)
          graph.add(list)
          graph.add(global)
          seed.pos = [0, 0]
          list.pos = [350, 0]
          global.pos = [700, 0]
          seed.widgets!.find((widget) => widget.name === 'seed')!.value =
            812_345
          list.widgets!.find((widget) => widget.name === 'min_num')!.value = 37
          list.widgets!.find((widget) => widget.name === 'max_num')!.value =
            9_731
          list.widgets!.find((widget) => widget.name === 'total')!.value = 23
          seed.connect(0, list, 4)
          return {
            global: String(global.id),
            list: String(list.id),
            seed: String(seed.id)
          }
        })

        if (vueNodesEnabled) {
          await comfyPage.vueNodes.selectComboOption(
            'EasyGlobalSeed',
            'action',
            'decrement for each node'
          )
        } else {
          const globalNode = await comfyPage.nodeOps.getNodeRefById(ids.global)
          const actionWidget = await globalNode.getWidgetByName('action')
          await actionWidget.click()
          await comfyPage.page
            .locator('.litecontextmenu .litemenu-entry', {
              hasText: 'decrement for each node'
            })
            .click()
        }

        const expectedLink = [[ids.seed, 0, ids.list, 4]]
        const inputLinks = () => packPersistence.projectInputLinks(ids.list)
        await expect.poll(inputLinks).toEqual(expectedLink)
        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              ({ listId, seedId }) => {
                const nodes = window.app!.graph.nodes
                const seed = nodes.find(
                  (candidate) => String(candidate.id) === seedId
                )!
                const list = nodes.find(
                  (candidate) => String(candidate.id) === listId
                )!
                return {
                  list: list
                    .widgets!.filter(({ name }) =>
                      ['min_num', 'max_num', 'total'].includes(name)
                    )
                    .map(({ name, value }) => ({ name, value })),
                  seed: seed.widgets!.find(({ name }) => name === 'seed')!
                    .value,
                  types: [seed.type, list.type]
                }
              },
              { listId: ids.list, seedId: ids.seed }
            )
          )
          .toEqual({
            list: [
              { name: 'min_num', value: 37 },
              { name: 'max_num', value: 9_731 },
              { name: 'total', value: 23 }
            ],
            seed: 812_345,
            types: ['easy seed', 'easy seedList']
          })
        await expect
          .poll(() =>
            comfyPage.page.evaluate((nodeId) => {
              const node = window.app!.graph.nodes.find(
                (candidate) => String(candidate.id) === nodeId
              )!
              return node.widgets!.map(({ name, value }) => ({ name, value }))
            }, ids.global)
          )
          .toEqual([
            { name: 'value', value: 0 },
            { name: 'mode', value: true },
            { name: 'action', value: 'decrement for each node' },
            { name: 'last_seed', value: '' }
          ])

        await comfyPage.menu.topbar.saveWorkflow(workflowName)
        await comfyPage.workflow.reloadAndWaitForApp()
        await openWorkflowFromSidebar(comfyPage, workflowName)

        await expect.poll(inputLinks).toEqual(expectedLink)
        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              ({ listId, seedId }) => {
                const nodes = window.app!.graph.nodes
                const seed = nodes.find(
                  (candidate) => String(candidate.id) === seedId
                )!
                const list = nodes.find(
                  (candidate) => String(candidate.id) === listId
                )!
                return {
                  list: list
                    .widgets!.filter(({ name }) =>
                      ['min_num', 'max_num', 'total'].includes(name)
                    )
                    .map(({ name, value }) => ({ name, value })),
                  seed: seed.widgets!.find(({ name }) => name === 'seed')!
                    .value,
                  types: [seed.type, list.type]
                }
              },
              { listId: ids.list, seedId: ids.seed }
            )
          )
          .toEqual({
            list: [
              { name: 'min_num', value: 37 },
              { name: 'max_num', value: 9_731 },
              { name: 'total', value: 23 }
            ],
            seed: 812_345,
            types: ['easy seed', 'easy seedList']
          })
        await expect
          .poll(() =>
            comfyPage.page.evaluate((nodeId) => {
              const node = window.app!.graph.nodes.find(
                (candidate) => String(candidate.id) === nodeId
              )!
              return {
                type: node.type,
                widgets: node.widgets!.map(({ name, value }) => ({
                  name,
                  value
                }))
              }
            }, ids.global)
          )
          .toEqual({
            type: 'easy globalSeed',
            widgets: [
              { name: 'value', value: 0 },
              { name: 'mode', value: true },
              { name: 'action', value: 'decrement for each node' },
              { name: 'last_seed', value: '' }
            ]
          })
      })

    for (const renderer of [
      { name: 'legacy', tags: [] },
      { name: 'Vue', tags: ['@vue-nodes'] }
    ]) {
      if (renderer.name === 'Vue')
        test(
          `PromptChain visible reorder and saved connections survive reload (${renderer.name} renderer)`,
          { tag: renderer.tags },
          async ({ comfyPage, packPersistence, savedWorkflows }) => {
            test.slow()
            await comfyPage.settings.setSetting(
              'Comfy.VueNodes.Enabled',
              renderer.name === 'Vue'
            )
            await comfyPage.workflow.setupWorkflowsDirectory({})
            await comfyPage.workflow.reloadAndWaitForApp()
            await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
            await comfyPage.workflow.waitForWorkflowIdle()
            await comfyPage.nodeOps.clearGraph()

            const workflowName = `actual-promptchain-${renderer.name.toLowerCase()}-${crypto.randomUUID()}`
            savedWorkflows.track(workflowName)
            const ids = await comfyPage.page.evaluate(() => {
              const graph = window.app!.graph
              const makeNode = (
                title: string,
                promptValue: string,
                modeValue: string
              ) => {
                const node = window.LiteGraph!.createNode(
                  'PromptChain_PromptChain'
                )!
                node.title = title
                graph.add(node)
                node.widgets!.find(
                  (widget) => widget.name === 'prompt'
                )!.value = promptValue
                node.widgets!.find((widget) => widget.name === 'mode')!.value =
                  modeValue
                return node
              }
              const root = makeNode(
                'Chain Root',
                'SETUP root prompt',
                'combine'
              )
              const children = [
                makeNode('Chain Alpha', 'SETUP alpha prompt', 'switch'),
                makeNode('Chain Beta', 'SETUP beta prompt', 'iterate'),
                makeNode('Chain Gamma', 'SETUP gamma prompt', 'combine')
              ]
              for (const child of children) {
                const targetSlot = root.inputs.findIndex(
                  (input) => input.name.includes('in_') && input.link == null
                )
                child.connect(0, root, targetSlot)
              }
              return {
                root: String(root.id),
                children: children.map((node) => String(node.id))
              }
            })

            const inputLinks = () => packPersistence.projectInputLinks(ids.root)
            const initialLinks = [
              [ids.children[0], 0, ids.root, 0],
              [ids.children[1], 0, ids.root, 1],
              [ids.children[2], 0, ids.root, 2]
            ]
            await expect.poll(inputLinks).toEqual(initialLinks)

            const onboardingSkip = comfyPage.page.getByText('Skip', {
              exact: true
            })
            if (await onboardingSkip.isVisible()) await onboardingSkip.click()
            const rootNode = comfyPage.page.locator(
              `[data-node-id="${ids.root}"]`
            )
            await rootNode.getByTitle('Fullscreen editor').click()
            const tree = comfyPage.page.locator('.pcr-nettree-items')
            const visibleOrder = () =>
              tree.locator('.pcr-nettree-name').allTextContents()
            await expect
              .poll(visibleOrder)
              .toEqual([
                'Chain Root',
                'Chain Alpha',
                'Chain Beta',
                'Chain Gamma'
              ])

            const alpha = tree
              .locator('.pcr-nettree-row')
              .filter({ hasText: 'Chain Alpha' })
            const gamma = tree
              .locator('.pcr-nettree-row')
              .filter({ hasText: 'Chain Gamma' })
            await alpha.dragTo(gamma, { targetPosition: { x: 40, y: 24 } })
            await expect
              .poll(visibleOrder)
              .toEqual([
                'Chain Root',
                'Chain Beta',
                'Chain Gamma',
                'Chain Alpha'
              ])
            await expect.poll(inputLinks).toEqual([
              [ids.children[1], 0, ids.root, 0],
              [ids.children[2], 0, ids.root, 1],
              [ids.children[0], 0, ids.root, 2]
            ])
            await comfyPage.page.getByTitle('Close (Escape)').click()

            await comfyPage.menu.topbar.saveWorkflow(workflowName)
            await comfyPage.workflow.reloadAndWaitForApp()
            await openWorkflowFromSidebar(comfyPage, workflowName)

            await expect.poll(inputLinks).toEqual([
              [ids.children[1], 0, ids.root, 0],
              [ids.children[2], 0, ids.root, 1],
              [ids.children[0], 0, ids.root, 2]
            ])
            await expect
              .poll(() =>
                comfyPage.page.evaluate(
                  (nodeIds) => {
                    return nodeIds.map((nodeId) => {
                      const node = window.app!.graph.nodes.find(
                        (candidate) => String(candidate.id) === nodeId
                      )!
                      return {
                        title: node.title,
                        type: node.type,
                        widgets: node
                          .widgets!.filter(
                            (widget) =>
                              widget.name === 'prompt' || widget.name === 'mode'
                          )
                          .map((widget) => ({
                            name: widget.name,
                            value: widget.value
                          }))
                      }
                    })
                  },
                  [ids.root, ...ids.children]
                )
              )
              .toEqual([
                {
                  title: 'Prompt Chain',
                  type: 'PromptChain_PromptChain',
                  widgets: [
                    { name: 'prompt', value: 'SETUP root prompt' },
                    { name: 'mode', value: 'combine' }
                  ]
                },
                {
                  title: 'Prompt Chain',
                  type: 'PromptChain_PromptChain',
                  widgets: [
                    { name: 'prompt', value: 'SETUP alpha prompt' },
                    { name: 'mode', value: 'switch' }
                  ]
                },
                {
                  title: 'Prompt Chain',
                  type: 'PromptChain_PromptChain',
                  widgets: [
                    { name: 'prompt', value: 'SETUP beta prompt' },
                    { name: 'mode', value: 'iterate' }
                  ]
                },
                {
                  title: 'Prompt Chain',
                  type: 'PromptChain_PromptChain',
                  widgets: [
                    { name: 'prompt', value: 'SETUP gamma prompt' },
                    { name: 'mode', value: 'combine' }
                  ]
                }
              ])
          }
        )

      test(
        `VHS uploads and combines a real video with format controls (${renderer.name} renderer)`,
        { tag: renderer.tags },
        async ({ comfyPage, packPersistence }, testInfo) => {
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
                  // Generated with ffmpeg from testsrc2 (32x32, 2 fps, 1s) and a 440 Hz sine (8 kHz, 1s), encoded as H.264/AAC.
                  buffer: await readFile(assetPath('vhs_video_with_audio.mp4'))
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

          const setFormat = async (value: string) => {
            if (useVueNodes) {
              await comfyPage.vueNodes.selectComboOption(
                'Video Combine 🎥🅥🅗🅢',
                'format',
                value
              )
              return
            }

            const position = await comfyPage.page.evaluate((combineId) => {
              const node = window.app!.graph.nodes.find(
                (candidate) => String(candidate.id) === combineId
              )!
              const format = node.widgets!.find(
                (widget) => widget.name === 'format'
              )!
              const bounds = node.getBounding()
              return window.app!.canvasPosToClientPos([
                bounds[0] + bounds[2] / 2,
                bounds[1] +
                  window.LiteGraph!['NODE_TITLE_HEIGHT'] +
                  format.last_y! +
                  1
              ])
            }, ids.combine)
            await comfyPage.page.mouse.click(position[0], position[1])
            await comfyPage.page
              .locator('.litecontextmenu .litemenu-entry', { hasText: value })
              .click()
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
