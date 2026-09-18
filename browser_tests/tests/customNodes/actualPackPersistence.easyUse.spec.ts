import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import type { LinkTuple } from '@e2e/fixtures/customNode/packPersistenceFixture'
import { packPersistenceTest as test } from '@e2e/fixtures/customNode/packPersistenceFixture'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'
import { hasInstalledPack } from '@e2e/fixtures/utils/customNodeSuite'

test.describe(
  'actual custom-pack persistence @custom-nodes',
  { tag: ['@oss', '@node', '@widget'] },
  () => {
    if (!hasInstalledPack('ComfyUI-Easy-Use')) return

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
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

        const globalNode = await comfyPage.nodeOps.getNodeRefById(ids.global)
        await globalNode.centerOnNode()

        if (vueNodesEnabled) {
          await comfyPage.vueNodes.selectComboOption(
            'EasyGlobalSeed',
            'action',
            'decrement for each node'
          )
        } else {
          const actionWidget = await globalNode.getWidgetByName('action')
          await actionWidget.click()
          await comfyPage.page
            .locator('.litecontextmenu .litemenu-entry', {
              hasText: 'decrement for each node'
            })
            .click()
        }

        const expectedLink = [[ids.seed, 0, ids.list, 4]] satisfies LinkTuple[]
        const inputLinks = () => packPersistence.projectInputLinks(ids.list)
        const readState = () =>
          comfyPage.page.evaluate(
            ({ globalId, listId, seedId }) => {
              const nodes = window.app!.graph.nodes
              const seed = nodes.find(
                (candidate) => String(candidate.id) === seedId
              )!
              const list = nodes.find(
                (candidate) => String(candidate.id) === listId
              )!
              const global = nodes.find(
                (candidate) => String(candidate.id) === globalId
              )!
              return {
                global: {
                  type: global.type,
                  widgets: global.widgets!.map(({ name, value }) => ({
                    name,
                    value
                  }))
                },
                list: list
                  .widgets!.filter(({ name }) =>
                    ['min_num', 'max_num', 'total'].includes(name)
                  )
                  .map(({ name, value }) => ({ name, value })),
                seed: seed.widgets!.find(({ name }) => name === 'seed')!.value,
                types: [seed.type, list.type]
              }
            },
            { globalId: ids.global, listId: ids.list, seedId: ids.seed }
          )
        const expectedState = {
          global: {
            type: 'easy globalSeed',
            widgets: [
              { name: 'value', value: 0 },
              { name: 'mode', value: true },
              { name: 'action', value: 'decrement for each node' },
              { name: 'last_seed', value: '' }
            ]
          },
          list: [
            { name: 'min_num', value: 37 },
            { name: 'max_num', value: 9_731 },
            { name: 'total', value: 23 }
          ],
          seed: 812_345,
          types: ['easy seed', 'easy seedList']
        }

        await expect.poll(inputLinks).toEqual(expectedLink)
        await expect.poll(readState).toEqual(expectedState)

        await comfyPage.menu.topbar.saveWorkflow(workflowName)
        await comfyPage.workflow.reloadAndWaitForApp()
        await openWorkflowFromSidebar(comfyPage, workflowName)

        await expect.poll(inputLinks).toEqual(expectedLink)
        await expect.poll(readState).toEqual(expectedState)
      })
  }
)
