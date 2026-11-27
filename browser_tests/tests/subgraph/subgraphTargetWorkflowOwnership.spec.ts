import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { WorkspaceStore } from '@e2e/types/globals'

test.describe(
  'Subgraph target workflow ownership',
  { tag: ['@canvas', '@subgraph'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({
        'visible-target.json': 'subgraphs/basic-subgraph.json',
        'background-target.json': 'subgraphs/basic-subgraph.json'
      })
      await comfyPage.workflow.openPersistedWorkflow('visible-target')
      await comfyPage.workflow.openPersistedWorkflow('background-target')
      await comfyPage.workflow.switchToTab('background-target')
      const backgroundSubgraph = await comfyPage.nodeOps.getNodeRefById(2)
      await backgroundSubgraph.navigateIntoSubgraph()
      const backgroundSampler = await comfyPage.nodeOps.getNodeRefById(1)
      await backgroundSampler.centerOnNode()
      const backgroundSeed = await backgroundSampler.getWidgetByName('seed')
      await backgroundSeed.click()
      await comfyPage.page.keyboard.press('ControlOrMeta+A')
      await comfyPage.page.keyboard.type('24680')
      await comfyPage.page.keyboard.press('Enter')
      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            () =>
              window
                .app!.canvas.graph!.nodes.find(({ id }) => String(id) === '1')
                ?.widgets?.find(({ name }) => name === 'seed')?.value
          )
        )
        .toBe(24680)
      await comfyPage.page.evaluate(() => {
        const subgraphId = window.app!.rootGraph.subgraphs.keys().next().value
        if (!subgraphId) throw new Error('Background subgraph not loaded')
        const registered = window.LiteGraph!.registered_node_types[subgraphId]
        Reflect.set(window, '__backgroundSubgraphNodeClass', registered)
      })
      await comfyPage.subgraph.exitViaBreadcrumb()
      await comfyPage.workflow.switchToTab('visible-target')
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
    })

    test('keeps edits workflow-local with a stale foreign registration across tab switches', async ({
      comfyPage
    }) => {
      const graphIds = await comfyPage.page.evaluate(() => {
        const store = (window.app!.extensionManager as WorkspaceStore).workflow
        const workflow = store.workflows.find(({ path }) =>
          path.endsWith('background-target.json')
        )
        return {
          active: window.app!.rootGraph.id,
          background: workflow?.graph?.id ?? null
        }
      })
      expect(graphIds.background).not.toBe(graphIds.active)
      test.setTimeout(60_000)

      await test.step('restore background workflow and stale registration', async () => {
        await comfyPage.page.evaluate(async () => {
          const store = (window.app!.extensionManager as WorkspaceStore)
            .workflow
          const workflow = store.workflows.find(({ path }) =>
            path.endsWith('background-target.json')
          )
          if (!workflow?.graph)
            throw new Error('Background workflow not loaded')
          const graphData = workflow.activeState
          if (!graphData) throw new Error('Background workflow has no state')
          const loaded = await window.app!.loadGraphData(
            graphData,
            false,
            false,
            workflow
          )
          if (!loaded) throw new Error('Background workflow restore failed')
        })
        await comfyPage.page.evaluate(() => {
          const subgraphId = window.app!.rootGraph.subgraphs.keys().next().value
          const registered = Reflect.get(
            window,
            '__backgroundSubgraphNodeClass'
          )
          if (!subgraphId || !registered)
            throw new Error('Background subgraph registration not captured')
          window.LiteGraph!.registerNodeType(subgraphId, registered)
        })
      })

      const addedSubgraph =
        await test.step('insert and edit visible workflow subgraph', async () => {
          const subgraphId = await comfyPage.page.evaluate(() => {
            const id = window.app!.rootGraph.subgraphs.keys().next().value
            if (!id) throw new Error('Visible subgraph not loaded')
            return id
          })
          const addedSubgraph = await comfyPage.nodeOps.addNode(
            subgraphId,
            undefined,
            {
              x: 250,
              y: 250
            }
          )
          const binding = await comfyPage.page.evaluate((nodeId) => {
            const graph = window.app!.rootGraph
            const node = graph.nodes.find(({ id }) => id === nodeId)
            if (!node?.isSubgraphNode()) return null
            node.setSize([400, 200])
            graph.setDirtyCanvas(true, true)
            return {
              nodeRoot: node.subgraph.rootGraph.id,
              visibleRoot: graph.id
            }
          }, addedSubgraph.id)
          expect(binding).toEqual({
            nodeRoot: graphIds.active,
            visibleRoot: graphIds.active
          })
          await comfyPage.nextFrame()
          await addedSubgraph.navigateIntoSubgraph()
          const visibleSampler = await comfyPage.nodeOps.getNodeRefById(1)
          await visibleSampler.centerOnNode()
          const visibleSeed = await visibleSampler.getWidgetByName('seed')
          await visibleSeed.click()
          await comfyPage.page.keyboard.press('ControlOrMeta+A')
          await comfyPage.page.keyboard.type('13579')
          await comfyPage.page.keyboard.press('Enter')
          await expect
            .poll(() =>
              comfyPage.page.evaluate(
                () =>
                  window
                    .app!.canvas.graph!.nodes.find(
                      ({ id }) => String(id) === '1'
                    )
                    ?.widgets?.find(({ name }) => name === 'seed')?.value
              )
            )
            .toBe(13579)
          await comfyPage.subgraph.exitViaBreadcrumb()
          return addedSubgraph
        })

      await test.step('verify background workflow is unchanged', async () => {
        await comfyPage.workflow.switchToTab('background-target')
        const backgroundSubgraph = await comfyPage.nodeOps.getNodeRefById(2)
        await backgroundSubgraph.navigateIntoSubgraph()
        const backgroundSampler = await comfyPage.nodeOps.getNodeRefById(1)
        await backgroundSampler.getWidgetByName('seed')
        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              () =>
                window
                  .app!.canvas.graph!.nodes.find(({ id }) => String(id) === '1')
                  ?.widgets?.find(({ name }) => name === 'seed')?.value
            )
          )
          .toBe(24680)
        await comfyPage.subgraph.exitViaBreadcrumb()
      })

      await test.step('verify visible workflow edit survives tab return', async () => {
        await comfyPage.workflow.switchToTab('visible-target')
        await addedSubgraph.navigateIntoSubgraph()
        const restoredVisibleSampler = await comfyPage.nodeOps.getNodeRefById(1)
        await restoredVisibleSampler.getWidgetByName('seed')
        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              () =>
                window
                  .app!.canvas.graph!.nodes.find(({ id }) => String(id) === '1')
                  ?.widgets?.find(({ name }) => name === 'seed')?.value
            )
          )
          .toBe(13579)
      })
    })
  }
)
