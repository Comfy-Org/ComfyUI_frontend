import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { subgraphBreadcrumbFixture } from '@e2e/fixtures/helpers/SubgraphBreadcrumbHelper'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'

import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import { toNodeId } from '@/types/nodeId'

const test = mergeTests(comfyPageFixture, subgraphBreadcrumbFixture)

const modes = [
  { label: 'LiteGraph', vueNodesEnabled: false },
  { label: 'Vue', vueNodesEnabled: true }
] as const

test.describe(
  'Subgraph ECS user scenarios',
  { tag: ['@subgraph', '@ui'] },
  () => {
    for (const mode of modes) {
      test.describe(
        `${mode.label} renderer`,
        { tag: mode.vueNodesEnabled ? '@vue-nodes' : undefined },
        () => {
          test.use({
            initialSettings: {
              'Comfy.VueNodes.Enabled': mode.vueNodesEnabled
            }
          })

          test('promoted widget values remain independent across copied hosts', async ({
            comfyPage
          }) => {
            await comfyPage.workflow.loadWorkflow(
              'subgraphs/subgraph-with-promoted-text-widget'
            )

            const original = await comfyPage.nodeOps.getNodeRefById('11')
            const hostWidget = async (node: NodeReference, nodeId: string) => {
              if (mode.vueNodesEnabled) {
                return comfyPage.vueNodes
                  .getNodeLocator(nodeId)
                  .getByRole('textbox', { name: 'text', exact: true })
              }

              const position = await (
                await node.getWidgetByName('text')
              ).getPosition()
              const textboxes = comfyPage.page.getByRole('textbox', {
                name: 'text',
                exact: true
              })
              const boxes = await textboxes.evaluateAll((elements) =>
                elements.map((element) => {
                  const { x, y, width, height } =
                    element.getBoundingClientRect()
                  return { x, y, width, height }
                })
              )
              const closestIndex = boxes.reduce(
                (best, box, index) => {
                  const distance = Math.hypot(
                    box.x + box.width / 2 - position.x,
                    box.y + box.height / 2 - position.y
                  )
                  return distance < best.distance ? { index, distance } : best
                },
                { index: -1, distance: Number.POSITIVE_INFINITY }
              ).index
              if (closestIndex < 0) {
                throw new Error(
                  `Text widget for node ${nodeId} was not rendered`
                )
              }
              return textboxes.nth(closestIndex)
            }

            const parentWidget = await hostWidget(original, '11')
            await expect(parentWidget).toHaveCount(1)
            await parentWidget.fill('original parent edit')
            await expect(parentWidget).toHaveValue('original parent edit')
            await expect
              .poll(() =>
                original.getWidgetByName('text').then((w) => w.getValue())
              )
              .toBe('original parent edit')

            await original.click('title')
            await comfyPage.clipboard.copy()
            await comfyPage.clipboard.paste()
            await expect
              .poll(() =>
                comfyPage.page.evaluate(
                  () =>
                    window.app!.graph.nodes.filter((node) =>
                      node.isSubgraphNode()
                    ).length
                )
              )
              .toBe(2)

            const copyId = await comfyPage.page.evaluate(() => {
              const copy = window.app!.graph.nodes.find(
                (node) => node.isSubgraphNode() && String(node.id) !== '11'
              )
              if (!copy) throw new Error('Pasted subgraph host was not created')
              return String(copy.id)
            })
            const copy = await comfyPage.nodeOps.getNodeRefById(copyId)
            const copyWidget = await hostWidget(copy, copyId)
            await expect(copyWidget).toHaveCount(1)
            await copyWidget.fill('copy-only edit')

            await expect(copyWidget).toHaveValue('copy-only edit')
            const originalWidget = await hostWidget(original, '11')
            await expect(originalWidget).toHaveValue('original parent edit')
            await expect
              .poll(() =>
                copy.getWidgetByName('text').then((w) => w.getValue())
              )
              .toBe('copy-only edit')
            await expect
              .poll(() =>
                original.getWidgetByName('text').then((w) => w.getValue())
              )
              .toBe('original parent edit')

            await originalWidget.fill('original second edit')
            await expect(originalWidget).toHaveValue('original second edit')
            await expect(copyWidget).toHaveValue('copy-only edit')
            await expect
              .poll(() =>
                original.getWidgetByName('text').then((w) => w.getValue())
              )
              .toBe('original second edit')
            await expect
              .poll(() =>
                copy.getWidgetByName('text').then((w) => w.getValue())
              )
              .toBe('copy-only edit')

            await copy.delete()
            await expect.poll(() => copy.exists()).toBe(false)
            await expect(parentWidget).toHaveValue('original second edit')
            await parentWidget.fill('original survives duplicate deletion')
            await expect
              .poll(() =>
                original.getWidgetByName('text').then((w) => w.getValue())
              )
              .toBe('original survives duplicate deletion')
          })

          for (const deleteOriginal of [true, false]) {
            test(`surviving ${deleteOriginal ? 'copy' : 'original'} opens and edits after save/reload`, async ({
              comfyPage
            }) => {
              await comfyPage.workflow.setupWorkflowsDirectory({})
              await comfyPage.workflow.loadWorkflow(
                'subgraphs/subgraph-with-promoted-text-widget'
              )
              const original = await comfyPage.nodeOps.getNodeRefById('11')
              await original.click('title')
              await comfyPage.clipboard.copy()
              await comfyPage.clipboard.paste()

              await expect
                .poll(() =>
                  comfyPage.page.evaluate(() =>
                    window.app!.graph.nodes.some(
                      (node) =>
                        node.isSubgraphNode() && String(node.id) !== '11'
                    )
                  )
                )
                .toBe(true)
              const copyId = await comfyPage.page.evaluate(() =>
                String(
                  window.app!.graph.nodes.find(
                    (node) => node.isSubgraphNode() && String(node.id) !== '11'
                  )!.id
                )
              )

              const survivorId = deleteOriginal ? copyId : '11'
              const survivorNodeId = toNodeId(survivorId)
              const survivorGraphId = await comfyPage.page.evaluate(
                (survivorNodeId) => {
                  const survivor =
                    window.app!.rootGraph.getNodeById(survivorNodeId)
                  if (!survivor?.isSubgraphNode()) {
                    throw new Error(`Subgraph host ${survivorNodeId} not found`)
                  }
                  return survivor.subgraph.id
                },
                survivorNodeId
              )
              const removedId = toNodeId(deleteOriginal ? '11' : copyId)
              await comfyPage.page.evaluate((removedId) => {
                const node = window.app!.rootGraph.getNodeById(removedId)
                if (!node) throw new Error(`Node ${removedId} not found`)
                window.app!.canvas.deselectAll()
                window.app!.canvas.selectNode(node)
              }, removedId)
              await comfyPage.page.keyboard.press('Delete')
              await comfyPage.nextFrame()
              await expect
                .poll(() =>
                  comfyPage.page.evaluate(
                    (removedId) => ({
                      isRootGraphActive:
                        window.app!.canvas.graph === window.app!.rootGraph,
                      removedNodeExists:
                        window.app!.rootGraph.getNodeById(removedId) !== null
                    }),
                    removedId
                  )
                )
                .toEqual({ isRootGraphActive: true, removedNodeExists: false })
              const workflowName = `${mode.label.toLowerCase()}-${deleteOriginal ? 'copy' : 'original'}-survivor`
              const workflowPath = `/api/userdata/${encodeURIComponent(`workflows/${workflowName}.json`)}`
              const saveResponse = comfyPage.page.waitForResponse(
                (response) =>
                  new URL(response.url()).pathname === workflowPath &&
                  response.request().method() === 'POST'
              )
              await comfyPage.menu.topbar.saveWorkflow(workflowName)
              const encodedSave = await saveResponse
              expect(encodedSave.status()).toBe(200)
              expect(encodedSave.request().headers()['comfy-user']).toBe(
                comfyPage.id
              )
              const encodedWorkflow = zComfyWorkflow.parse(
                encodedSave.request().postDataJSON()
              )

              const persistedResponse = await comfyPage.request.get(
                `${comfyPage.apiUrl}${workflowPath}`,
                { headers: { 'Comfy-User': comfyPage.id } }
              )
              expect(persistedResponse.ok()).toBe(true)
              const persistedWorkflow = zComfyWorkflow.parse(
                await persistedResponse.json()
              )
              const serializedHostIds = (workflow: typeof encodedWorkflow) =>
                workflow.nodes
                  .filter((node) =>
                    workflow.definitions?.subgraphs.some(
                      (subgraph) => subgraph.id === node.type
                    )
                  )
                  .map((node) => String(node.id))
              expect(serializedHostIds(encodedWorkflow)).toEqual([survivorId])
              expect(serializedHostIds(persistedWorkflow)).toEqual([survivorId])

              await comfyPage.workflow.reloadAndWaitForApp()
              await comfyPage.menu.workflowsTab.open()
              await comfyPage.menu.workflowsTab
                .getPersistedItem(workflowName)
                .click()
              await comfyPage.menu.workflowsTab.close()

              const survivor =
                await comfyPage.nodeOps.getNodeRefById(survivorId)
              await expect.poll(() => survivor.exists()).toBe(true)
              if (mode.vueNodesEnabled) {
                await comfyPage.vueNodes.enterSubgraph(survivorId)
              } else {
                await survivor.navigateIntoSubgraph()
              }
              await expect
                .poll(() =>
                  comfyPage.page.evaluate(() => window.app!.canvas.graph?.id)
                )
                .toBe(survivorGraphId)

              const innerId = await comfyPage.page.evaluate(() => {
                const graph = window.app!.canvas.graph
                if (!graph) throw new Error('Surviving subgraph did not open')
                const inner = graph.nodes.find(
                  (node) => node.type === 'CLIPTextEncode'
                )
                if (!inner) throw new Error('Inner text node not found')
                return String(inner.id)
              })
              const inner = await comfyPage.nodeOps.getNodeRefById(innerId)
              await expect.poll(() => inner.exists()).toBe(true)
              const originalInnerPosition = await inner.getPosition()
              await inner.dragBy({ x: 40, y: 20 })
              await expect
                .poll(() => inner.getPosition())
                .not.toEqual(originalInnerPosition)
            })
          }

          test('nested controls and breadcrumbs preserve exact topology and root undo', async ({
            comfyPage,
            subgraphBreadcrumb
          }) => {
            await comfyPage.workflow.loadWorkflow('subgraphs/nested-subgraph')

            const topology = () =>
              comfyPage.page.evaluate(() => {
                const graph = window.app!.canvas.graph
                if (!graph) throw new Error('Canvas graph is not available')
                return {
                  nodes: graph.nodes.map((node) => String(node.id)).sort(),
                  links: [...graph.links.values()]
                    .map((link) => [
                      String(link.origin_id),
                      link.origin_slot,
                      String(link.target_id),
                      link.target_slot
                    ])
                    .sort()
                }
              })

            expect(await topology()).toEqual({
              nodes: ['10', '8', '9'],
              links: [
                ['10', 0, '8', 0],
                ['10', 1, '8', 1],
                ['8', 0, '9', 0]
              ]
            })

            const rootNode = await comfyPage.nodeOps.getNodeRefById('8')
            const originalPosition = await rootNode.getPosition()
            await rootNode.dragBy({ x: 80, y: 40 })
            await expect
              .poll(() => rootNode.getPosition())
              .not.toEqual(originalPosition)
            await comfyPage.keyboard.undo()
            await expect
              .poll(() => rootNode.getPosition())
              .toEqual(originalPosition)

            const outer = await comfyPage.nodeOps.getNodeRefById('10')
            if (mode.vueNodesEnabled) {
              await comfyPage.vueNodes.enterSubgraph('10')
            } else {
              await outer.navigateIntoSubgraph()
            }
            expect(await topology()).toEqual({
              nodes: ['11', '3', '6'],
              links: [
                ['11', 0, '3', 2],
                ['11', 1, '3', 3],
                ['11', 2, '3', 0],
                ['11', 3, '6', 0],
                ['11', 4, '-20', 1],
                ['3', 0, '-20', 0],
                ['6', 0, '3', 1]
              ]
            })

            const inner = await comfyPage.nodeOps.getNodeRefById('11')
            if (mode.vueNodesEnabled) {
              await comfyPage.vueNodes.enterSubgraph('11')
            } else {
              await inner.navigateIntoSubgraph()
            }
            expect(await topology()).toEqual({
              nodes: ['4', '5', '7'],
              links: [
                ['4', 0, '-20', 2],
                ['4', 1, '-20', 3],
                ['4', 1, '7', 0],
                ['4', 2, '-20', 4],
                ['5', 0, '-20', 1],
                ['7', 0, '-20', 0]
              ]
            })

            await subgraphBreadcrumb.clickItem(
              'subgraph-8beb610f-ddd1-4489-ae0d-2f732a4042ae'
            )
            expect(await topology()).toEqual({
              nodes: ['11', '3', '6'],
              links: [
                ['11', 0, '3', 2],
                ['11', 1, '3', 3],
                ['11', 2, '3', 0],
                ['11', 3, '6', 0],
                ['11', 4, '-20', 1],
                ['3', 0, '-20', 0],
                ['6', 0, '3', 1]
              ]
            })
            await subgraphBreadcrumb.clickItem('root')
            expect(await topology()).toEqual({
              nodes: ['10', '8', '9'],
              links: [
                ['10', 0, '8', 0],
                ['10', 1, '8', 1],
                ['8', 0, '9', 0]
              ]
            })
          })
        }
      )
    }
  }
)
