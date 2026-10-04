import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

/**
 * The unique-name invariant removes a widget it cannot name uniquely
 * (ADR-ECS-0008). This pins the boundary of "cannot": a widget whose `name` is
 * perfectly writable must never be the price of enforcing it.
 *
 * `BaseWidget.set name` delegates to `widgetValueStore.renameWidget()` and
 * returns without changing the name whenever the store declines — which it does
 * when the node has no entries, the state a node is in after it has been
 * removed from the graph. So a rename that *failed* does not prove the widget
 * is unaddressable, and removing on that signal destroys an ordinary widget.
 *
 * Reproduced through the graph API the way an undo of a node deletion or a
 * paste of a cut node reaches it: the node leaves the graph, the duplicate name
 * appears while it is detached, and it rejoins.
 *
 * Asserted on what the app saves, because that is where the loss is permanent.
 * Measured on the parent commit the node comes back one widget short and saves
 * **one** `widgets_values` entry for a two-widget node; the arity of that array
 * is what positional widget addressing reads, so a dropped slot shifts every
 * later widget. With the invariant's criterion corrected it saves both.
 *
 * Not asserted, and deliberately: the two slots do not hold the two *values*.
 * Re-registering an ambiguous pair routes the second widget's `name` setter
 * through `renameWidget` on a stale `_state.nodeId`, which hands it the first
 * widget's store entry, so both read the first widget's value. That is a
 * separate pre-existing defect in `BaseWidget.set name`, unchanged either way
 * here, and asserting the values would pin it as if it were correct.
 */

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

/**
 * Takes the node out of the graph, collides the second widget's name with the
 * first while it is detached, and puts it back. Detached is what makes the
 * write land: on a node that is still in the graph the store declines the
 * rename and the collision never forms.
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

      await collideNameWhileDetached(comfyPage, nodeId)

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

        // One entry here is a widget the user lost. Two is the invariant being
        // enforced without charging them for it.
        expect(savedNode?.widgets_values).toHaveLength(2)
      })
    })
  }
)
