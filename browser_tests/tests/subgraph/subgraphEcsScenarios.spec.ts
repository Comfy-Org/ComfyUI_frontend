import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { subgraphBreadcrumbFixture } from '@e2e/fixtures/helpers/SubgraphBreadcrumbHelper'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'

import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

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

            await copy.delete()
            await expect.poll(() => copy.exists()).toBe(false)
            await expect(parentWidget).toHaveValue('original parent edit')
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
              test.fail(
                !mode.vueNodesEnabled && deleteOriginal,
                'LiteGraph serialization retains a deleted original subgraph host'
              )
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

              const removed = await comfyPage.nodeOps.getNodeRefById(
                deleteOriginal ? '11' : copyId
              )
              const survivorId = deleteOriginal ? copyId : '11'
              await removed.delete()
              await expect.poll(() => removed.exists()).toBe(false)
              const workflowName = `${mode.label.toLowerCase()}-${deleteOriginal ? 'copy' : 'original'}-survivor`
              const workflowPath = `/api/userdata/${encodeURIComponent(`workflows/${workflowName}.json`)}`
              const saveResponse = comfyPage.page.waitForResponse(
                (response) =>
                  new URL(response.url()).pathname === workflowPath &&
                  response.request().method() === 'POST'
              )
              await comfyPage.menu.topbar.saveWorkflow(workflowName)
              expect((await saveResponse).status()).toBe(200)

              const persistedResponse = await comfyPage.request.get(
                `${comfyPage.apiUrl}${workflowPath}`,
                { headers: { 'Comfy-User': comfyPage.id } }
              )
              expect(persistedResponse.ok()).toBe(true)
              const persistedWorkflow = zComfyWorkflow.parse(
                await persistedResponse.json()
              )
              expect(
                persistedWorkflow.nodes
                  .filter((node) =>
                    persistedWorkflow.definitions?.subgraphs.some(
                      (subgraph) => subgraph.id === node.type
                    )
                  )
                  .map((node) => String(node.id))
              ).toEqual([survivorId])

              await comfyPage.workflow.reloadAndWaitForApp()
              await comfyPage.menu.workflowsTab.open()
              await comfyPage.menu.workflowsTab
                .getPersistedItem(workflowName)
                .click()

              const survivor =
                await comfyPage.nodeOps.getNodeRefById(survivorId)
              await expect.poll(() => survivor.exists()).toBe(true)
              const survivorWidget = comfyPage.page.getByRole('textbox', {
                name: 'text',
                exact: true
              })
              await expect(survivorWidget).toHaveCount(1)
              await survivorWidget.fill('editable after reload')
              await expect
                .poll(() =>
                  survivor.getWidgetByName('text').then((w) => w.getValue())
                )
                .toBe('editable after reload')
            })
          }

          test('nested controls and breadcrumbs preserve exact topology and root undo', async ({
            comfyPage,
            subgraphBreadcrumb
          }) => {
            await comfyPage.workflow.loadWorkflow('subgraphs/nested-subgraph')

            const topology = () =>
              comfyPage.page.evaluate(() => ({
                nodes: window
                  .app!.canvas.graph!.nodes.map((node) => String(node.id))
                  .sort(),
                links: [...window.app!.canvas.graph!.links.values()]
                  .map((link) => [
                    String(link.origin_id),
                    link.origin_slot,
                    String(link.target_id),
                    link.target_slot
                  ])
                  .sort()
              }))

            expect(await topology()).toEqual({
              nodes: ['10', '8', '9'],
              links: [
                ['10', 0, '8', 0],
                ['10', 1, '8', 1],
                ['8', 0, '9', 0]
              ]
            })

            const rootNode = await comfyPage.nodeOps.getNodeRefById('8')
            const originalPosition =
              await rootNode.getProperty<[number, number]>('pos')
            await rootNode.dragBy({ x: 80, y: 40 })
            await expect
              .poll(() => rootNode.getProperty<[number, number]>('pos'))
              .not.toEqual(originalPosition)
            await comfyPage.keyboard.undo()
            await expect
              .poll(() => rootNode.getProperty<[number, number]>('pos'))
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
