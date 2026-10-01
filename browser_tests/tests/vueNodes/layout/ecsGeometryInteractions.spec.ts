import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import { toRerouteId } from '@/types/rerouteId'

test.describe(
  'ECS migration geometry interactions',
  { tag: ['@canvas', '@node', '@vue-nodes'] },
  () => {
    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('slot dots track the node edge while resize is still active', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await fitToViewInstant(comfyPage)
      const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      const handle = node.getResizeHandle('SE')
      const outputDot = comfyPage.vueNodes.getOutputSlotConnectionDot('3', 0)
      const beforeNode = await node.boundingBox()
      const beforeDot = await outputDot.boundingBox()
      const handleBox = await handle.boundingBox()
      if (!(beforeNode && beforeDot && handleBox)) {
        throw new Error('Resize geometry is unavailable')
      }

      const start = {
        x: handleBox.x + handleBox.width / 2,
        y: handleBox.y + handleBox.height / 2
      }
      await comfyPage.page.mouse.move(start.x, start.y)
      await comfyPage.page.mouse.down()
      try {
        await comfyPage.page.mouse.move(start.x + 160, start.y + 80, {
          steps: 10
        })
        await comfyPage.nextFrame()

        const duringNode = await node.boundingBox()
        const duringDot = await outputDot.boundingBox()
        if (!(duringNode && duringDot)) {
          throw new Error('Live resize geometry disappeared')
        }
        expect(duringNode.width).toBeGreaterThan(beforeNode.width + 120)
        expect(duringDot.x).toBeGreaterThan(beforeDot.x + 120)
        expect(
          Math.abs(
            duringDot.x +
              duringDot.width / 2 -
              (duringNode.x + duringNode.width)
          ),
          'output dot remains on the visible right edge before pointer release'
        ).toBeLessThanOrEqual(2)
      } finally {
        await comfyPage.page.mouse.up()
      }
    })

    test('slot-dot and reroute paint are proven at 100%/400%', async ({
      comfyPage
    }) => {
      test.slow()
      const setZoom = async (
        scale: number,
        center: { x: number; y: number }
      ) => {
        await comfyPage.page.evaluate(
          ([nextScale, canvasCenter]) => {
            const canvas = window.app!.canvas
            const bounds = canvas.canvas.getBoundingClientRect()
            canvas.ds.scale = nextScale
            canvas.ds.offset[0] = bounds.width / 2 / nextScale - canvasCenter.x
            canvas.ds.offset[1] = bounds.height / 2 / nextScale - canvasCenter.y
            canvas.setDirty(true, true)
          },
          [scale, center] as const
        )
        await comfyPage.nextFrame()
      }
      const getDrawnSlotCenter = async (
        nodeId: string,
        slotName: string,
        type: 'input' | 'output',
        zoom: number
      ) => {
        const slotIndex = await comfyPage.page.evaluate(
          ([id, targetName, targetType]) => {
            const graphNode = window.app!.graph.getNodeById(id)
            if (!graphNode) throw new Error(`Node ${id} is unavailable`)
            const slots =
              targetType === 'input' ? graphNode.inputs : graphNode.outputs
            return slots.findIndex(({ name }) => name === targetName)
          },
          [toNodeId(nodeId), slotName, type] as const
        )
        if (slotIndex < 0)
          throw new Error(`${slotName} model slot is unavailable`)
        const dot =
          type === 'input'
            ? comfyPage.vueNodes.getInputSlotConnectionDot(nodeId, slotIndex)
            : comfyPage.vueNodes.getOutputSlotConnectionDot(nodeId, slotIndex)
        const box = await dot.boundingBox()
        if (!box && zoom >= 1) {
          throw new Error(
            `${type} ${nodeId}:${slotName} painted dot disappeared`
          )
        }
        const node = await comfyPage.nodeOps.getNodeRefById(nodeId)
        const slot = await (type === 'input'
          ? node.getInput(slotIndex)
          : node.getOutput(slotIndex))
        if (box) {
          const paintedRaster = await dot.screenshot()
          const originalStyle = await dot.getAttribute('style')
          await dot.evaluate((element) => {
            element.style.opacity = '0'
          })
          let transparentRaster: Buffer
          try {
            const transparentBox = await dot.boundingBox()
            expect(
              transparentBox,
              `${type} ${nodeId}:${slotName} opacity preserves boundary`
            ).toEqual(box)
            transparentRaster = await dot.screenshot()
          } finally {
            if (originalStyle === null) {
              await dot.evaluate((element) => element.removeAttribute('style'))
            } else {
              await dot.evaluate(
                (element, style) => element.setAttribute('style', style),
                originalStyle
              )
            }
          }
          const differingPixels = await comfyPage.page.evaluate(
            async ({ paintedBase64, transparentBase64 }) => {
              const decode = async (imageBase64: string) => {
                const image = new Image()
                image.src = `data:image/png;base64,${imageBase64}`
                await image.decode()
                const raster = document.createElement('canvas')
                raster.width = image.naturalWidth
                raster.height = image.naturalHeight
                const context = raster.getContext('2d')
                if (!context) throw new Error('Slot raster is unavailable')
                context.drawImage(image, 0, 0)
                return context.getImageData(0, 0, raster.width, raster.height)
              }
              const painted = await decode(paintedBase64)
              const transparent = await decode(transparentBase64)
              if (
                painted.width !== transparent.width ||
                painted.height !== transparent.height
              ) {
                throw new Error('Slot raster dimensions changed')
              }
              let count = 0
              for (let offset = 0; offset < painted.data.length; offset += 4) {
                if (
                  painted.data[offset] !== transparent.data[offset] ||
                  painted.data[offset + 1] !== transparent.data[offset + 1] ||
                  painted.data[offset + 2] !== transparent.data[offset + 2] ||
                  painted.data[offset + 3] !== transparent.data[offset + 3]
                ) {
                  count++
                }
              }
              return count
            },
            {
              paintedBase64: paintedRaster.toString('base64'),
              transparentBase64: transparentRaster.toString('base64')
            }
          )
          expect(
            differingPixels,
            `${type} ${nodeId}:${slotName} exact dot paint differs from opacity zero`
          ).toBeGreaterThan(0)
        }
        const modelCenter = box
          ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
          : await slot.getPosition()
        return { center: modelCenter, slot }
      }

      for (const zoom of [1, 4, 0.25]) {
        await comfyPage.workflow.loadWorkflow('selection/three-nodes-and-group')
        const fixtureIds = await comfyPage.page.evaluate(() => {
          const graph = window.app!.graph
          const addNode = (type: string, pos: [number, number]) => {
            const node = window.LiteGraph!.createNode(type)
            if (!node) throw new Error(`${type} is unavailable`)
            node.pos = pos
            graph.add(node)
            return String(node.id)
          }
          return {
            latent: addNode('EmptyLatentImage', [-275, 240]),
            preview: addNode('PreviewImage', [600, 240]),
            groupPreview: addNode('PreviewImage', [1000, 240])
          }
        })
        await comfyPage.nextFrame()
        const arms = [
          {
            source: ['1', 'samples', 'input'] as const,
            target: [fixtureIds.latent, 'LATENT', 'output'] as const,
            label: 'input'
          },
          {
            source: ['1', 'IMAGE', 'output'] as const,
            target: [fixtureIds.preview, 'images', 'input'] as const,
            label: 'output'
          },
          {
            source: ['2', 'IMAGE', 'output'] as const,
            target: [fixtureIds.groupPreview, 'images', 'input'] as const,
            label: 'group member output'
          }
        ]
        for (const arm of arms) {
          const sourceNode = await comfyPage.nodeOps.getNodeRefById(
            arm.source[0]
          )
          const targetNode = await comfyPage.nodeOps.getNodeRefById(
            arm.target[0]
          )
          const sourceSlot = await (arm.source[2] === 'input'
            ? sourceNode.getInput(0)
            : sourceNode.getOutput(0))
          const targetSlot = await (arm.target[2] === 'input'
            ? targetNode.getInput(0)
            : targetNode.getOutput(0))
          const canvasCenter = await comfyPage.page.evaluate(
            ([source, target]) => {
              const getPosition = ([id, name, type]: readonly [
                string,
                string,
                'input' | 'output'
              ]) => {
                const node = window.app!.graph.nodes.find(
                  (candidate) => String(candidate.id) === id
                )
                if (!node) throw new Error(`Node ${id} is unavailable`)
                const slots = type === 'input' ? node.inputs : node.outputs
                const index = slots.findIndex((slot) => slot.name === name)
                if (index < 0) throw new Error(`${name} is unavailable`)
                return node.getConnectionPos(type === 'input', index)
              }
              const sourcePos = getPosition(source)
              const targetPos = getPosition(target)
              return {
                x: (sourcePos[0] + targetPos[0]) / 2,
                y: (sourcePos[1] + targetPos[1]) / 2
              }
            },
            [arm.source, arm.target] as const
          )
          await setZoom(zoom, canvasCenter)
          const source = await getDrawnSlotCenter(
            arm.source[0],
            arm.source[1],
            arm.source[2],
            zoom
          )
          const target = await getDrawnSlotCenter(
            arm.target[0],
            arm.target[1],
            arm.target[2],
            zoom
          )
          await comfyPage.canvasOps.dragAndDrop(source.center, target.center)
          await sourceSlot.expectLinkCount(
            1,
            `${zoom} ${arm.label} source links`
          )
          await targetSlot.expectLinkCount(
            1,
            `${zoom} ${arm.label} target links`
          )
        }
      }

      for (const zoom of [0.25, 1, 4]) {
        await comfyPage.workflow.loadWorkflow(
          'reroute/single-native-reroute-default-workflow'
        )
        const reroute = await comfyPage.page.evaluate(() => {
          const reroute = window.app!.graph.reroutes.values().next().value
          if (!reroute) throw new Error('Reroute is unavailable')
          return {
            id: reroute.id,
            position: { x: reroute.pos[0], y: reroute.pos[1] }
          }
        })
        await setZoom(zoom, reroute.position)
        const rerouteCenter = await comfyPage.page.evaluate(() => {
          const reroute = window.app!.graph.reroutes.values().next().value
          if (!reroute) throw new Error('Reroute is unavailable')
          const [x, y] = window.app!.canvasPosToClientPos(reroute.pos)
          return { x, y }
        })
        if (zoom >= 1) {
          const clip = {
            x: rerouteCenter.x - 20,
            y: rerouteCenter.y - 20,
            width: 40,
            height: 40
          }
          const graphState = await comfyPage.page.evaluate((targetId) => {
            const canvas = window.app!.canvas
            const reroute = window.app!.graph.getReroute(targetId)
            if (!reroute) throw new Error(`Reroute ${targetId} is unavailable`)
            return {
              position: [...reroute.pos],
              selectedIds: [...canvas.selectedItems].map((item) => item.id),
              linkIds: [...reroute.linkIds]
            }
          }, toRerouteId(reroute.id))
          const paintedRaster = await comfyPage.page.screenshot({ clip })
          await comfyPage.page.evaluate((targetId) => {
            const canvas = window.app!.canvas
            const reroute = window.app!.graph.getReroute(targetId)
            if (!reroute) throw new Error(`Reroute ${targetId} is unavailable`)
            if (Object.hasOwn(reroute, 'draw')) {
              throw new Error(
                'Reroute draw suppression cannot preserve identity'
              )
            }
            reroute.draw = () => {}
            canvas.setDirty(true, true)
          }, toRerouteId(reroute.id))
          await comfyPage.nextFrame()
          let suppressedRaster: Buffer
          try {
            suppressedRaster = await comfyPage.page.screenshot({ clip })
            expect(
              await comfyPage.page.evaluate((targetId) => {
                const canvas = window.app!.canvas
                const reroute = window.app!.graph.getReroute(targetId)
                if (!reroute)
                  throw new Error(`Reroute ${targetId} is unavailable`)
                return {
                  position: [...reroute.pos],
                  selectedIds: [...canvas.selectedItems].map((item) => item.id),
                  linkIds: [...reroute.linkIds]
                }
              }, toRerouteId(reroute.id)),
              `${zoom} draw suppression preserves graph and hit state`
            ).toEqual(graphState)
          } finally {
            await comfyPage.page.evaluate((targetId) => {
              const canvas = window.app!.canvas
              const reroute = window.app!.graph.getReroute(targetId)
              if (!reroute)
                throw new Error(`Reroute ${targetId} is unavailable`)
              Reflect.deleteProperty(reroute, 'draw')
              canvas.setDirty(true, true)
            }, toRerouteId(reroute.id))
            await comfyPage.nextFrame()
          }
          const differingPixels = await comfyPage.page.evaluate(
            async ({ paintedBase64, suppressedBase64 }) => {
              const decode = async (imageBase64: string) => {
                const image = new Image()
                image.src = `data:image/png;base64,${imageBase64}`
                await image.decode()
                const raster = document.createElement('canvas')
                raster.width = image.naturalWidth
                raster.height = image.naturalHeight
                const context = raster.getContext('2d')
                if (!context) throw new Error('Reroute raster is unavailable')
                context.drawImage(image, 0, 0)
                return context.getImageData(0, 0, raster.width, raster.height)
              }
              const painted = await decode(paintedBase64)
              const suppressed = await decode(suppressedBase64)
              let count = 0
              for (let offset = 0; offset < painted.data.length; offset += 4) {
                if (
                  painted.data[offset] !== suppressed.data[offset] ||
                  painted.data[offset + 1] !== suppressed.data[offset + 1] ||
                  painted.data[offset + 2] !== suppressed.data[offset + 2] ||
                  painted.data[offset + 3] !== suppressed.data[offset + 3]
                ) {
                  count++
                }
              }
              return count
            },
            {
              paintedBase64: paintedRaster.toString('base64'),
              suppressedBase64: suppressedRaster.toString('base64')
            }
          )
          expect(
            differingPixels,
            `${zoom} reroute paint differs when only reroute.draw is suppressed`
          ).toBeGreaterThan(0)
        }
        const thresholdCrossing = 8
        const responseDelta = 24
        await comfyPage.page.mouse.move(rerouteCenter.x, rerouteCenter.y)
        await comfyPage.page.mouse.down()
        try {
          await comfyPage.page.mouse.move(
            rerouteCenter.x + thresholdCrossing,
            rerouteCenter.y + thresholdCrossing
          )
          await comfyPage.nextFrame()
          const establishedOrigin = await comfyPage.page.evaluate(
            (targetId) => {
              const canvas = window.app!.canvas
              const reroute = window.app!.graph.getReroute(targetId)
              if (!reroute)
                throw new Error(`Reroute ${targetId} is unavailable`)
              return {
                position: [...reroute.pos],
                selectedIds: [...canvas.selectedItems].map((item) => item.id)
              }
            },
            toRerouteId(reroute.id)
          )
          expect(
            establishedOrigin.selectedIds,
            `${zoom} drawn center selects the intended reroute`
          ).toEqual([reroute.id])

          await comfyPage.page.mouse.move(
            rerouteCenter.x + thresholdCrossing + responseDelta,
            rerouteCenter.y + thresholdCrossing + responseDelta
          )
          await comfyPage.nextFrame()
          const finalPosition = await comfyPage.page.evaluate((targetId) => {
            const reroute = window.app!.graph.getReroute(targetId)
            return reroute ? [...reroute.pos] : null
          }, toRerouteId(reroute.id))
          expect(
            finalPosition,
            `${zoom} intended reroute follows the post-threshold pointer delta`
          ).toEqual([
            expect.closeTo(
              establishedOrigin.position[0] + responseDelta / zoom,
              4
            ),
            expect.closeTo(
              establishedOrigin.position[1] + responseDelta / zoom,
              4
            )
          ])
        } finally {
          await comfyPage.page.mouse.up()
        }
      }
    })

    test('renamed slot stays aligned while moving and rewiring in legacy mode', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await fitToViewInstant(comfyPage)
      await expect(comfyPage.vueNodes.nodes).toHaveCount(0)

      await comfyPage.page.evaluate((nodeId) => {
        const node = window.app!.graph.getNodeById(nodeId)
        if (!node) throw new Error('Empty Latent Image is unavailable')
        node.addOutput('custom_latent', 'LATENT')
      }, toNodeId('5'))
      await comfyPage.nextFrame()
      const sourceNode = await comfyPage.nodeOps.getNodeRefById('5')
      const targetNode = await comfyPage.nodeOps.getNodeRefById('3')
      const sourceSlot = await sourceNode.getOutput(1)
      const targetSlot = await targetNode.getInput(3)
      const renamedLabel = 'renamed_latent'

      await comfyPage.page.evaluate((nodeId) => {
        const node = window.app!.graph.getNodeById(nodeId)
        if (!node) throw new Error('KSampler is unavailable')
        node.disconnectInput(3)
      }, toNodeId('3'))
      const initialSlotPosition = await sourceSlot.getPosition()
      await comfyPage.page.mouse.click(
        initialSlotPosition.x,
        initialSlotPosition.y,
        { button: 'right' }
      )
      await comfyPage.contextMenu.clickLitegraphMenuItem('Rename Slot')
      const renameInput = comfyPage.page.locator('.graphdialog input')
      await expect(renameInput).toBeVisible()
      await renameInput.fill(renamedLabel)
      await comfyPage.page.keyboard.press('Enter')

      await sourceNode.dragBy({ x: -100, y: 80 })
      await sourceSlot.expectLinkCount(0)
      await targetSlot.expectLinkCount(0)

      const sourceCenter = await sourceSlot.getPosition()
      const targetCenter = await targetSlot.getPosition()
      await comfyPage.canvasOps.dragAndDrop(sourceCenter, targetCenter)

      await sourceSlot.expectLinkCount(1)
      await targetSlot.expectLinkCount(1)
      expect(
        await comfyPage.page.evaluate(
          (nodeId) => window.app!.graph.getNodeById(nodeId)?.outputs[1]?.label,
          toNodeId('5')
        )
      ).toBe(renamedLabel)
      await comfyPage.canvasOps.moveMouseToEmptyArea()
      await comfyPage.nextFrame()
      await expect(comfyPage.canvas).toHaveScreenshot(
        'ecs-renamed-moved-wired-legacy.png'
      )
    })

    for (const vueNodesEnabled of [false, true]) {
      test(`remains interactive after an incompatible link gesture in ${vueNodesEnabled ? 'Nodes 2.0' : 'legacy'} mode`, async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('default')
        await fitToViewInstant(comfyPage)
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        if (vueNodesEnabled) {
          await comfyPage.vueNodes.waitForNodes()
        } else {
          await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
        }

        const sampler = await comfyPage.nodeOps.getNodeRefById('3')
        const prompt = await comfyPage.nodeOps.getNodeRefById('6')
        const output = await sampler.getOutput(0)
        const incompatibleInput = await prompt.getInput(0)
        const beforePosition = await sampler.getPosition()
        const originalOutputLink = await output.getLink()
        const originalInputLink = await incompatibleInput.getLink()
        expect(originalOutputLink).not.toBeNull()
        expect(originalInputLink).not.toBeNull()

        await comfyPage.canvasOps.dragAndDrop(
          await output.getPosition(),
          await incompatibleInput.getPosition()
        )
        await output.expectLinkCount(1)
        await incompatibleInput.expectLinkCount(1)
        expect(await output.getLink()).toEqual(originalOutputLink)
        expect(await incompatibleInput.getLink()).toEqual(originalInputLink)

        await sampler.dragBy({ x: 80, y: 40 })
        await expect(async () => {
          const afterPosition = await sampler.getPosition()
          expect(afterPosition.x).toBeCloseTo(beforePosition.x + 80, -1)
          expect(afterPosition.y).toBeCloseTo(beforePosition.y + 40, -1)
        }).toPass({ timeout: 5000 })
        await expect(comfyPage.toast.toastErrors).toHaveCount(0)
      })
    }

    for (const vueNodesEnabled of [false, true]) {
      test(`reroute position and parent survive reload in ${vueNodesEnabled ? 'Nodes 2.0' : 'legacy'}`, async ({
        comfyPage
      }) => {
        test.slow()
        await comfyPage.workflow.loadWorkflow(
          'reroute/single-native-reroute-default-workflow'
        )
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await fitToViewInstant(comfyPage)
        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => window.app!.graph.reroutes.size)
          )
          .toBe(1)
        const saved = await comfyPage.page.evaluate(() => {
          const reroute = window.app!.graph.reroutes.values().next().value
          if (!reroute) throw new Error('Reroute was not created')
          return {
            id: reroute.id,
            parentId: reroute.parentId,
            pos: [...reroute.pos]
          }
        })

        await comfyPage.workflow.reloadAndWaitForApp()
        await comfyPage.canvasOps.expectRootReroutePositions({
          [toRerouteId(saved.id)]: { x: saved.pos[0], y: saved.pos[1] }
        })
        await expect
          .poll(() =>
            comfyPage.page.evaluate((id) => {
              const reroute = window.app!.graph.reroutes.get(id)
              return reroute?.parentId ?? null
            }, saved.id)
          )
          .toBe(saved.parentId ?? null)
      })

      test(`deleting rerouted endpoints preserves then prunes the floating chain in ${vueNodesEnabled ? 'Nodes 2.0' : 'legacy'}`, async ({
        comfyPage
      }) => {
        test.slow()
        await comfyPage.workflow.loadWorkflow(
          'reroute/single-native-reroute-default-workflow'
        )
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await fitToViewInstant(comfyPage)

        const stateIds = {
          floatingLinkId: toLinkId(10),
          linkId: toLinkId(3),
          nodeId: toNodeId('6'),
          rerouteId: toRerouteId(1)
        }
        const readState = async () => {
          return comfyPage.page.evaluate(
            ({ floatingLinkId, linkId, nodeId, rerouteId }) => {
              const graph = window.app!.graph
              const link = graph.links.get(linkId)
              const floatingLink = graph.floatingLinks.get(floatingLinkId)
              const reroute = graph.reroutes.get(rerouteId)
              return {
                nodeExists: Boolean(graph.getNodeById(nodeId)),
                link: link
                  ? {
                      id: link.id,
                      originId: link.origin_id,
                      originSlot: link.origin_slot,
                      targetId: link.target_id,
                      targetSlot: link.target_slot,
                      parentId: link.parentId
                    }
                  : null,
                rerouteLinkIds: [...(reroute?.linkIds ?? [])],
                floatingLink: floatingLink
                  ? {
                      id: floatingLink.id,
                      originId: floatingLink.origin_id,
                      originSlot: floatingLink.origin_slot,
                      targetId: floatingLink.target_id,
                      targetSlot: floatingLink.target_slot,
                      parentId: floatingLink.parentId
                    }
                  : null,
                rerouteFloatingLinkIds: [...(reroute?.floatingLinkIds ?? [])]
              }
            },
            stateIds
          )
        }

        await test.step('verify the connected reroute topology', async () => {
          await expect.poll(readState).toEqual({
            nodeExists: true,
            link: {
              id: 3,
              originId: '4',
              originSlot: 1,
              targetId: '6',
              targetSlot: 0,
              parentId: 1
            },
            rerouteLinkIds: [3],
            floatingLink: null,
            rerouteFloatingLinkIds: []
          })
        })

        const beforeDelete =
          await test.step('delete the rerouted target', async () => {
            const target = await comfyPage.nodeOps.getNodeRefById('6')
            await target.click('title')
            const timestamp = Date.now()
            await comfyPage.keyboard.delete()
            return timestamp
          })

        const expectedState = {
          nodeExists: false,
          link: null,
          rerouteLinkIds: [],
          floatingLink: {
            id: 10,
            originId: '4',
            originSlot: 1,
            targetId: '-1',
            targetSlot: -1,
            parentId: 1
          },
          rerouteFloatingLinkIds: [10]
        }

        await test.step('verify and reload the floating chain', async () => {
          await expect.poll(readState).toEqual(expectedState)
          await comfyPage.workflow.waitForDraftIndexUpdatedSince(beforeDelete)
          await comfyPage.workflow.reloadAndWaitForApp()
          await expect.poll(readState).toEqual(expectedState)
        })

        await test.step('delete the remaining endpoint and reload the pruned chain', async () => {
          const source = await comfyPage.nodeOps.getNodeRefById('4')
          await source.click('title')
          const timestamp = Date.now()
          await comfyPage.keyboard.delete()
          await expect.poll(readState).toEqual({
            nodeExists: false,
            link: null,
            rerouteLinkIds: [],
            floatingLink: null,
            rerouteFloatingLinkIds: []
          })
          await expect
            .poll(() =>
              comfyPage.page.evaluate(
                (rerouteId) => window.app!.graph.reroutes.has(rerouteId),
                stateIds.rerouteId
              )
            )
            .toBe(false)
          await comfyPage.workflow.waitForDraftIndexUpdatedSince(timestamp)
          await comfyPage.workflow.reloadAndWaitForApp()
          await expect.poll(readState).toEqual({
            nodeExists: false,
            link: null,
            rerouteLinkIds: [],
            floatingLink: null,
            rerouteFloatingLinkIds: []
          })
          await expect
            .poll(() =>
              comfyPage.page.evaluate(
                (rerouteId) => window.app!.graph.reroutes.has(rerouteId),
                stateIds.rerouteId
              )
            )
            .toBe(false)
        })
      })

      test(`recovers from empty link search and malformed clipboard in ${vueNodesEnabled ? 'Nodes 2.0' : 'legacy'}`, async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('default')
        await fitToViewInstant(comfyPage)
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await comfyPage.settings.setSetting(
          'Comfy.LinkRelease.Action',
          'search box'
        )
        const sampler = await comfyPage.nodeOps.getNodeRefById('3')
        const output = await sampler.getOutput(0)
        const beforePosition = await sampler.getPosition()
        const outputPosition = await output.getPosition()
        await comfyPage.canvasOps.dragAndDrop(outputPosition, {
          x: 1000,
          y: 600
        })
        await expect(comfyPage.searchBoxV2.input).toBeVisible()
        await comfyPage.page.keyboard.press('Escape')
        await expect(comfyPage.searchBoxV2.input).toBeHidden()

        await sampler.dragBy({ x: 30, y: 15 })
        await expect
          .poll(() => sampler.getPosition())
          .toEqual({
            x: expect.closeTo(beforePosition.x + 30, -1),
            y: expect.closeTo(beforePosition.y + 15, -1)
          })
        const afterLinkSearchPosition = await sampler.getPosition()

        await comfyPage.page
          .context()
          .grantPermissions(['clipboard-read', 'clipboard-write'])
        await comfyPage.page.evaluate(async () => {
          await navigator.clipboard.writeText('{ malformed workflow')
        })
        const nodeCount = await comfyPage.nodeOps.getGraphNodesCount()
        await comfyPage.clipboard.paste()
        await comfyPage.page.keyboard.press('Escape')
        await expect
          .poll(() => comfyPage.nodeOps.getGraphNodesCount())
          .toBe(nodeCount)
        await sampler.dragBy({ x: 60, y: 30 })
        await expect
          .poll(() => sampler.getPosition())
          .toEqual({
            x: expect.closeTo(afterLinkSearchPosition.x + 60, -1),
            y: expect.closeTo(afterLinkSearchPosition.y + 30, -1)
          })
        await expect(comfyPage.toast.toastErrors).toHaveCount(0)
      })
    }

    for (const vueNodesEnabled of [false, true]) {
      test(`Send to Back reverses overlap selection in ${vueNodesEnabled ? 'Nodes 2.0' : 'legacy'}`, async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow('default')
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await fitToViewInstant(comfyPage)
        await comfyPage.page.evaluate(
          (nodeIds) => {
            const graph = window.app!.graph
            const canvas = window.app!.canvas
            const lower = graph.getNodeById(nodeIds[0])
            const upper = graph.getNodeById(nodeIds[1])
            if (!(lower && upper))
              throw new Error('Overlap nodes are unavailable')
            lower.title = 'Lower overlap node'
            upper.title = 'Upper overlap node'
            upper.pos = [...lower.pos]
            canvas.bringToFront(upper)
            canvas.deselectAllNodes()
            canvas.setDirty(true, true)
          },
          [toNodeId('6'), toNodeId('7')] as const
        )
        await comfyPage.nextFrame()
        const lower = await comfyPage.nodeOps.getNodeRefById('6')
        const overlapPosition = await lower.getTitlePosition()
        const overlap = await comfyPage.canvasOps.toAbsolute(overlapPosition)

        await comfyPage.canvasOps.mouseClickAt(overlapPosition)
        await expect
          .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
          .toEqual([toNodeId('7')])
        await comfyPage.page.evaluate(() => {
          window.app!.canvas.deselectAllNodes()
          window.app!.canvas.setDirty(true, true)
        })
        await comfyPage.nextFrame()
        const before = await comfyPage.page.screenshot({
          clip: { x: overlap.x - 40, y: overlap.y - 14, width: 180, height: 70 }
        })

        await comfyPage.page.evaluate((nodeId) => {
          const graph = window.app!.graph
          const node = graph.getNodeById(nodeId)
          if (!node) throw new Error('Upper overlap node is unavailable')
          window.app!.canvas.sendToBack(node)
          window.app!.canvas.deselectAllNodes()
          window.app!.canvas.setDirty(true, true)
        }, toNodeId('7'))
        await comfyPage.nextFrame()
        const after = await comfyPage.page.screenshot({
          clip: { x: overlap.x - 40, y: overlap.y - 14, width: 180, height: 70 }
        })
        expect(
          after.equals(before),
          'Send to Back changes overlap paint without a selection highlight'
        ).toBe(false)

        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => {
              const pointer = window.app!.canvas.pointer
              if (!pointer.eLastDown) return true
              return performance.now() - pointer.eLastDown.timeStamp > 300
            })
          )
          .toBe(true)
        await comfyPage.canvasOps.mouseClickAt(overlapPosition)
        await expect
          .poll(() => comfyPage.nodeOps.getSelectedNodeIds())
          .toEqual([toNodeId('6')])
      })
    }

    test(
      'overlapping multiline text remains clipped to each node',
      { tag: '@screenshot' },
      async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow('default')
        await fitToViewInstant(comfyPage)
        await comfyPage.page.evaluate((nodeId) => {
          const sampler = window.app!.graph.getNodeById(nodeId)
          if (!sampler) throw new Error('KSampler is unavailable')
          const seed = sampler.widgets?.find((widget) => widget.name === 'seed')
          if (!seed) throw new Error('Seed widget is unavailable')
          seed.value = 123456789
          sampler.setDirtyCanvas(true, true)
        }, toNodeId('3'))
        for (const vueNodesEnabled of [false, true]) {
          await comfyPage.settings.setSetting(
            'Comfy.VueNodes.Enabled',
            vueNodesEnabled
          )
          if (vueNodesEnabled) {
            await comfyPage.vueNodes.waitForNodes()
          } else {
            await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
          }
          await fitToViewInstant(comfyPage)
          const first = await comfyPage.nodeOps.getNodeRefById('6')
          const second = await comfyPage.nodeOps.getNodeRefById('7')
          const [firstX, firstY] =
            await first.getProperty<[number, number]>('pos')
          const targetPosition: [number, number] = [firstX + 100, firstY + 70]
          await comfyPage.page.evaluate(
            ([nodeId, position]) => {
              const node = window.app!.graph.getNodeById(nodeId)
              if (!node) throw new Error('Text node is unavailable')
              node.pos = position
              node.setDirtyCanvas(true, true)
            },
            [toNodeId('7'), targetPosition] as const
          )
          await expect
            .poll(async () => [
              ...(await second.getProperty<[number, number]>('pos'))
            ])
            .toEqual(targetPosition)
          await comfyPage.page.evaluate(() => {
            window.app!.canvas.deselectAllNodes()
          })
          await comfyPage.canvasOps.moveMouseToEmptyArea()
          await comfyPage.nextFrame()
          const clip = await comfyPage.page.evaluate(
            (nodeIds) => {
              const nodes = nodeIds.map((id) => {
                const node = window.app!.graph.getNodeById(id)
                if (!node) throw new Error(`Text node ${id} is unavailable`)
                const [x, y, width, height] = node.getBounding()
                const [left, top] = window.app!.canvasPosToClientPos([x, y])
                const [right, bottom] = window.app!.canvasPosToClientPos([
                  x + width,
                  y + height
                ])
                return { left, top, right, bottom }
              })
              const padding = 20
              const x = Math.max(
                0,
                Math.min(...nodes.map(({ left }) => left)) - padding
              )
              const y = Math.max(
                0,
                Math.min(...nodes.map(({ top }) => top)) - padding
              )
              const right = Math.min(
                window.innerWidth,
                Math.max(...nodes.map((node) => node.right)) + padding
              )
              const bottom = Math.min(
                window.innerHeight,
                Math.max(...nodes.map((node) => node.bottom)) + padding
              )
              return { x, y, width: right - x, height: bottom - y }
            },
            [toNodeId('6'), toNodeId('7')]
          )
          await expect(comfyPage.page).toHaveScreenshot(
            `ecs-overlapping-text-${vueNodesEnabled ? 'vue' : 'legacy'}.png`,
            { clip }
          )
        }
      }
    )

    test(
      'node title and widget labels remain rendered at text zoom extremes',
      { tag: '@screenshot' },
      async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow('default')
        await fitToViewInstant(comfyPage)
        const sampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
        await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)
          if (!node) throw new Error('KSampler is unavailable')
          const seed = node.widgets?.find((widget) => widget.name === 'seed')
          if (!seed) throw new Error('Seed widget is unavailable')
          seed.value = 123456789
          node.setDirtyCanvas(true, true)
        }, toNodeId('3'))
        await comfyPage.vueNodes.selectNode('3')
        for (const zoom of [0.5, 2]) {
          await comfyPage.page.evaluate(
            ([scale, nodeId]) => {
              const canvas = window.app!.canvas
              const node = window.app!.graph.getNodeById(nodeId)
              if (!node) throw new Error('KSampler is unavailable')
              const [x, y, width, height] = node.boundingRect
              canvas.ds.scale = scale
              canvas.ds.offset = [
                canvas.canvas.width / 2 / scale - (x + width / 2),
                canvas.canvas.height / 2 / scale - (y + height / 2)
              ]
              canvas.setDirty(true, true)
            },
            [zoom, toNodeId('3')] as const
          )
          await comfyPage.nextFrame()
          await expect(sampler.title).toBeVisible()
          const seedLabel = sampler.root.getByText('seed', { exact: true })
          await expect(seedLabel).toBeVisible()
          await expect(sampler.title).toHaveScreenshot(
            `ecs-title-zoom-${zoom * 100}.png`
          )
          await expect(seedLabel).toHaveScreenshot(
            `ecs-seed-label-zoom-${zoom * 100}.png`
          )
        }
      }
    )
  }
)
