import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

/**
 * The unique-name invariant removes a widget it cannot name uniquely
 * (ADR-ECS-0008). This pins the boundary of "cannot": a widget whose `name` is
 * writable must never be the price of enforcing it.
 *
 * Driven through the graph API the way an undo of a node deletion or a paste of
 * a cut node reaches it, and asserted on both the rendered rows and what the
 * app saves. Two values, not just two slots: an ambiguous pair used to route
 * the second widget's setter onto the entry the first had registered, so both
 * read one value while the slot count still looked right.
 */

const NODE_TYPE = 'DevToolsNodeWithOutputList'
const KEPT_NAME = 'alpha'
const RENAMED_NAME = 'beta'

/** Two distinct, ordinary, serializable widgets, both with writable names. */
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

/**
 * Collides the second widget's name with the first while the node is detached,
 * then puts it back. Detached is what lets the write land, so this is the
 * sequence an undo or a paste reaches.
 */
async function collideNameWhileDetached(
  comfyPage: ComfyPage,
  nodeId: string
): Promise<void> {
  await comfyPage.page.evaluate(
    ({ id, duplicateName, renamedName }) => {
      const graph = window.app!.graph
      const node = graph.nodes.find((candidate) => String(candidate.id) === id)
      if (!node) throw new Error(`node ${id} not found`)

      graph.remove(node)
      const target = node.widgets?.find(({ name }) => name === renamedName)
      if (!target) throw new Error(`widget ${renamedName} not found`)
      target.name = duplicateName
      graph.add(node)
    },
    { id: nodeId, duplicateName: KEPT_NAME, renamedName: RENAMED_NAME }
  )
}

test.describe(
  'renamable duplicate widget name',
  { tag: ['@canvas', '@widget', '@vue-nodes'] },
  () => {
    // Per attempt: a module-scope stamp is shared by every worker and retry.
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

      await collideNameWhileDetached(comfyPage, nodeId)

      await test.step('both widgets are still drawn after the re-add', async () => {
        // The saved values below cannot see this: they come from the widget
        // objects, which survive a node that registers nothing.
        await expect(node.getByTestId(TestIds.widgets.widget)).toHaveCount(2)
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

        // One entry here is a widget the user lost.
        expect(savedNode?.widgets_values).toHaveLength(2)

        // Distinct values, because arity alone cannot tell a preserved widget
        // from one welded onto its duplicate's entry.
        expect(savedNode?.widgets_values).toEqual([
          'first default',
          'second default'
        ])
      })
    })
  }
)
