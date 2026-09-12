import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { subgraphBreadcrumbFixture } from '@e2e/fixtures/helpers/SubgraphBreadcrumbHelper'

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
      test.describe(`${mode.label} renderer`, () => {
        test.beforeEach(async ({ comfyPage }) => {
          await comfyPage.settings.setSetting(
            'Comfy.VueNodes.Enabled',
            mode.vueNodesEnabled
          )
        })

        test('parent edits reach the exact interior widget and copied hosts remain independent', async ({
          comfyPage
        }) => {
          await comfyPage.workflow.loadWorkflow(
            'subgraphs/subgraph-with-promoted-text-widget'
          )

          const original = await comfyPage.nodeOps.getNodeRefById('11')
          const parentWidget = comfyPage.page.getByRole('textbox', {
            name: 'text',
            exact: true
          })
          await expect(parentWidget).toHaveCount(1)
          await parentWidget.fill('original parent edit')
          await expect(parentWidget).toHaveValue('original parent edit')

          await original.navigateIntoSubgraph()
          const interiorWidget = comfyPage.page.getByRole('textbox', {
            name: 'text',
            exact: true
          })
          await expect(interiorWidget).toHaveCount(1)
          await expect(interiorWidget).toHaveValue('original parent edit')
          await comfyPage.subgraph.exitViaBreadcrumb()

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
          const hostWidgets = comfyPage.page.getByRole('textbox', {
            name: 'text',
            exact: true
          })
          await expect(hostWidgets).toHaveCount(2)
          const originalWidget = hostWidgets.first()
          const copyWidget = hostWidgets.last()
          await copyWidget.fill('copy-only edit')

          await expect(copyWidget).toHaveValue('copy-only edit')
          await expect(originalWidget).toHaveValue('original parent edit')

          await copy.delete()
          await expect.poll(() => copy.exists()).toBe(false)
          await expect(parentWidget).toHaveValue('original parent edit')
          await parentWidget.fill('original survives duplicate deletion')
          await original.navigateIntoSubgraph()
          await expect(interiorWidget).toHaveValue(
            'original survives duplicate deletion'
          )
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
                    (node) => node.isSubgraphNode() && String(node.id) !== '11'
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
            await comfyPage.menu.topbar.saveWorkflow(
              `${mode.label.toLowerCase()}-${deleteOriginal ? 'copy' : 'original'}-survivor`
            )
            await comfyPage.workflow.reloadAndWaitForApp()

            const survivor = await comfyPage.nodeOps.getNodeRefById(survivorId)
            await expect.poll(() => survivor.exists()).toBe(true)
            const survivorWidget = comfyPage.page.getByRole('textbox', {
              name: 'text',
              exact: true
            })
            await expect(survivorWidget).toHaveCount(1)
            await survivorWidget.fill('editable after reload')
            await survivor.navigateIntoSubgraph()
            await expect(
              comfyPage.page.getByRole('textbox', {
                name: 'text',
                exact: true
              })
            ).toHaveValue('editable after reload')
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
          await comfyPage.keyboard.undo()
          await expect
            .poll(() => rootNode.getProperty<[number, number]>('pos'))
            .toEqual(originalPosition)

          const outer = await comfyPage.nodeOps.getNodeRefById('10')
          await outer.navigateIntoSubgraph()
          expect(await topology()).toEqual({
            nodes: ['10', '3', '6'],
            links: [
              ['10', 0, '3', 2],
              ['10', 1, '3', 3],
              ['10', 2, '3', 0],
              ['10', 3, '6', 0],
              ['10', 4, '-20', 1],
              ['3', 0, '-20', 0],
              ['6', 0, '3', 1]
            ]
          })

          const inner = await comfyPage.nodeOps.getNodeRefById('10')
          await inner.navigateIntoSubgraph()
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
          expect((await topology()).nodes).toEqual(['10', '3', '6'])
          await subgraphBreadcrumb.clickItem('root')
          expect((await topology()).nodes).toEqual(['10', '8', '9'])
        })
      })
    }
  }
)
