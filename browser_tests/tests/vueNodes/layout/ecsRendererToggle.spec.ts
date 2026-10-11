import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { expectRenderedTextUnclipped } from '@e2e/fixtures/utils/renderedText'

test.describe(
  'ECS migration: renderer toggle and zoom rendering',
  { tag: ['@canvas', '@node', '@widget'] },
  () => {
    test.describe.configure({ timeout: 60_000 })
    test.use({
      initialSettings: { 'Comfy.VueNodes.Enabled': false }
    })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
    })

    test.afterEach(async ({ comfyPage }) => {
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
          await test.step('Capture the initial workflow state', async () => {
            const nodeCount = await comfyPage.nodeOps.getGraphNodesCount()
            expect(nodeCount).toBeGreaterThan(0)
          })

          await test.step(`Switch from the ${startInVue ? 'Vue' : 'legacy'} renderer`, async () => {
            if (startInVue) {
              await comfyPage.settings.setSetting(
                'Comfy.VueNodes.Enabled',
                true
              )
              await comfyPage.vueNodes.waitForNodes()
            }

            await comfyPage.settings.setSetting(
              'Comfy.VueNodes.Enabled',
              !startInVue
            )
            if (startInVue) {
              await comfyPage.nextFrame()
              await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
            } else {
              await comfyPage.vueNodes.waitForNodes()
            }
          })

          const kSampler = await comfyPage.nodeOps.getNodeRefById('3')
          const initialPosition =
            await kSampler.getProperty<[number, number]>('pos')

          await test.step('Edit node geometry and widget state', async () => {
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
              await comfyPage.vueNodes.setInputNumberValue(cfgWidget, '7.5')
            }
            await expect
              .poll(() => kSampler.getProperty<[number, number]>('pos'))
              .not.toEqual(initialPosition)
          })

          const expectedSerialized =
            await comfyPage.nodeOps.getSerializedGraph()

          const expectedRuntime =
            await test.step('Switch back and verify the complete workflow', async () => {
              await comfyPage.settings.setSetting(
                'Comfy.VueNodes.Enabled',
                startInVue
              )
              if (startInVue) {
                await comfyPage.vueNodes.waitForNodes()
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
              return expectedRuntime
            })

          await test.step('Save, reload, and verify persistence', async () => {
            await comfyPage.menu.topbar.saveWorkflow(
              `Renderer Round Trip ${label}`
            )
            await comfyPage.workflow.reloadAndWaitForApp()
            if (startInVue) {
              await comfyPage.vueNodes.waitForNodes()
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
        await test.step(`Complete renderer round trip ${toggle + 1}`, async () => {
          await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
          await comfyPage.vueNodes.waitForNodes()
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
        })
      }

      await expect(comfyPage.toast.toastErrors).toHaveCount(0)
    })

    for (const { label, scale } of [
      { label: '50%', scale: 0.5 },
      { label: '200%', scale: 2 }
    ]) {
      test(`renders Vue widget labels and titles at ${label} zoom`, async ({
        comfyPage
      }, testInfo) => {
        const longTitle = 'KSampler Advanced Controls'
        const longWidgetLabel = 'guidance scale'

        await test.step(`Configure long text at ${label} zoom`, async () => {
          await comfyPage.page.evaluate(
            ({ longTitle, longWidgetLabel }) => {
              const node = window.app!.graph.nodes.find(
                (node) => node.id === '3'
              )
              if (!node) throw new Error('Expected default workflow node id 3')
              node.title = longTitle
              const cfgWidget = node.widgets?.find(
                (widget) => widget.name === 'cfg'
              )
              if (!cfgWidget) {
                throw new Error(
                  'Expected cfg widget on default workflow node id 3'
                )
              }
              cfgWidget.label = longWidgetLabel
              window.app!.graph.setDirtyCanvas(true, true)
            },
            { longTitle, longWidgetLabel }
          )
          await comfyPage.nextFrame()

          await comfyPage.canvasOps.resetView()
          await comfyPage.canvasOps.setScale(scale)
          const kSampler = await comfyPage.nodeOps.getNodeRefById('3')
          await kSampler.centerOnNode()
          await expect
            .poll(() => comfyPage.canvasOps.getScale())
            .toBeCloseTo(scale, 2)
        })

        await test.step('Enable Vue nodes and preserve the zoom level', async () => {
          await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
          await comfyPage.vueNodes.waitForNodes()
          await expect
            .poll(() => comfyPage.canvasOps.getScale())
            .toBeCloseTo(scale, 2)
        })

        const cfgWidget =
          await test.step('Verify visible and unclipped Vue text', async () => {
            const vueNode = comfyPage.vueNodes.getNodeByTitle(longTitle)
            const title = vueNode.getByTestId('node-title')
            await expect(title).toBeVisible()
            await expect(title).toHaveText(longTitle)
            const titleBox = await title.boundingBox()
            if (!titleBox) {
              throw new Error('Long title must have a rendered bounding box')
            }
            expect(titleBox.width).toBeGreaterThan(0)
            expect(titleBox.height).toBeGreaterThan(0)
            const titleContainer = vueNode.getByTestId('node-header-3')
            await expectRenderedTextUnclipped(
              title.getByText(longTitle, { exact: true }),
              titleContainer
            )

            const cfgWidget = comfyPage.vueNodes
              .getWidgetByName(longTitle, 'cfg')
              .first()
            await expect(cfgWidget).toBeVisible()
            const cfgRow = comfyPage.vueNodes.getWidgetRowByLabel(
              longTitle,
              longWidgetLabel
            )
            await expect(cfgRow).toBeVisible()
            const cfgLabel = cfgRow.getByTestId(
              TestIds.widgets.layoutFieldLabel
            )
            await expect(cfgLabel).toHaveText(longWidgetLabel)
            const labelBox = await cfgLabel.boundingBox()
            if (!labelBox) {
              throw new Error(
                'Long widget label must have a rendered bounding box'
              )
            }
            expect(labelBox.width).toBeGreaterThan(0)
            expect(labelBox.height).toBeGreaterThan(0)
            await expectRenderedTextUnclipped(cfgLabel, cfgRow)
            const screenshotPath = testInfo.outputPath(`vue-text-${label}.png`)
            await vueNode.screenshot({
              animations: 'disabled',
              path: screenshotPath
            })
            await testInfo.attach(`vue-text-${label}.png`, {
              contentType: 'image/png',
              path: screenshotPath
            })

            if (scale === 2) {
              await test.step('Reject deliberately clipped text', async () => {
                for (const { container, text } of [
                  { container: titleContainer, text: title },
                  { container: cfgRow, text: cfgLabel }
                ]) {
                  const originalStyle = await text.getAttribute('style')
                  await text.evaluate((element) => {
                    if (!(element instanceof HTMLElement)) {
                      throw new Error('Expected text to be an HTML element')
                    }
                    const width = document.createRange()
                    width.selectNodeContents(element)
                    const scaleX =
                      element.offsetWidth > 0
                        ? element.getBoundingClientRect().width /
                          element.offsetWidth
                        : 1
                    const halfWidth = `${width.getBoundingClientRect().width / scaleX / 2}px`
                    element.style.width = halfWidth
                    element.style.minWidth = '0'
                    element.style.maxWidth = halfWidth
                    element.style.flex = `0 0 ${halfWidth}`
                    element.style.display = 'inline-block'
                    element.style.position = 'absolute'
                    element.style.overflow = 'hidden'
                    element.style.whiteSpace = 'nowrap'
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
              })
            }
            return cfgWidget
          })

        await test.step('Edit the Vue numeric widget', async () => {
          await comfyPage.vueNodes.setInputNumberValue(cfgWidget, '7.5')
        })
      })
    }
  }
)
