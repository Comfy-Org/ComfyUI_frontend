import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

import { zComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'

const NODE_TYPE = 'DevToolsNodeWithOutputList'
const KEPT_NAME = 'alpha'
const RENAMED_NAME = 'beta'

/**
 * Patches the node type so every instance carries two distinct, ordinary,
 * serializable widgets. Both names are writable, so neither is ever
 * unaddressable — which is the whole point.
 */
async function installTwoOrdinaryWidgets(comfyPage: ComfyPage): Promise<void> {
  await comfyPage.page.evaluate(
    ({ nodeTypeName, first, second }) => {
      const nodeType = window.LiteGraph!.registered_node_types[nodeTypeName]
      const onNodeCreated = nodeType.prototype.onNodeCreated
      nodeType.prototype.onNodeCreated = function (...args) {
        onNodeCreated?.apply(this, args)
        this.serialize_widgets = true
        this.addWidget('string', first, 'first default', () => {})
        this.addWidget('string', second, 'second default', () => {})
      }
    },
    { nodeTypeName: NODE_TYPE, first: KEPT_NAME, second: RENAMED_NAME }
  )
}

async function collideNameWhileDetached(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<string[]> {
  return comfyPage.page.evaluate(
    ({ id, duplicateName, renamedName }) => {
      const graph = window.app!.graph
      const node = graph.nodes.find((candidate) => String(candidate.id) === id)
      if (!node) throw new Error(`node ${id} not found`)

      graph.remove(node)
      const target = node.widgets?.find(({ name }) => name === renamedName)
      if (!target) throw new Error(`widget ${renamedName} not found`)
      target.name = duplicateName
      Object.defineProperty(target, 'name', {
        get: () => duplicateName,
        set: () => undefined,
        configurable: true
      })
      graph.add(node)
      return (node.widgets ?? []).map(({ name }) => name)
    },
    { id: nodeId, duplicateName: KEPT_NAME, renamedName: RENAMED_NAME }
  )
}

test.describe(
  'renamable duplicate widget name',
  { tag: ['@canvas', '@widget', '@vue-nodes'] },
  () => {
    // Per attempt, not per module: a module-scope stamp is shared by every
    // worker in the process and by a retry.
    let workflowName = ''

    test.afterEach(async ({ comfyPage }) => {
      if (workflowName) await comfyPage.workflow.deleteWorkflow(workflowName)
    })

    test('keeps the widget whose rename was declined rather than impossible', async ({
      comfyPage
    }, testInfo) => {
      workflowName = `renamable-duplicate-widget-${testInfo.parallelIndex}-${testInfo.retry}-${Date.now()}`

      await comfyPage.nodeOps.clearGraph()
      await installTwoOrdinaryWidgets(comfyPage)

      const nodeId = await comfyPage.searchBoxV2.addNodeAndGetId(
        'Node With Output List'
      )
      const node = comfyPage.vueNodes.getNodeLocator(nodeId)
      await expect(node).toBeVisible()

      await test.step('both widgets are drawn to begin with', async () => {
        await expect(node.getByTestId(TestIds.widgets.widget)).toHaveCount(2)
      })

      const namesAfterRejoin = await collideNameWhileDetached(comfyPage, nodeId)

      await test.step('the duplicate name is still unresolved after rejoining', async () => {
        expect(namesAfterRejoin).toEqual([KEPT_NAME, KEPT_NAME])
      })

      await test.step('the node still draws the widget that kept the name', async () => {
        await expect(node.getByTestId(TestIds.widgets.widget)).toHaveCount(1)
      })

      await test.step('and the node still saves both widget slots', async () => {
        const savedRequest = comfyPage.page.waitForRequest(
          (request) =>
            request.method() === 'POST' &&
            decodeURIComponent(new URL(request.url()).pathname).endsWith(
              `/workflows/${workflowName}.json`
            )
        )
        await comfyPage.menu.topbar.saveWorkflowAs(workflowName)
        const saved = zComfyWorkflow.parse(
          JSON.parse((await savedRequest).postData() ?? '{}')
        )
        const savedNode = saved.nodes.find(({ type }) => type === NODE_TYPE)

        expect(savedNode?.widgets_values).toHaveLength(2)
        expect(savedNode?.widgets_values).toEqual([
          'first default',
          'second default'
        ])
      })
    })
  }
)
