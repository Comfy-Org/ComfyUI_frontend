import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'

import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

const NODE_TYPE = 'DevToolsNodeWithOutputList'

const test = comfyPageFixture.extend<{ workflowName: string }>({
  workflowName: async ({ comfyPage }, use, testInfo) => {
    const name = `unique-widget-name-${testInfo.parallelIndex}-${testInfo.retry}-${Date.now()}`
    await use(name)
    await comfyPage.workflow.deleteWorkflow(name)
  }
})

async function addNodeWithWidgets(
  comfyPage: ComfyPage,
  widgets: {
    first: string
    second: string
    third?: string
    pinSecondAs?: string
  }
): Promise<{ node: Locator; nodeId: string }> {
  await comfyPage.nodeOps.clearGraph()
  await comfyPage.page.evaluate(
    ({ nodeTypeName, first, second, third, pinSecondAs }) => {
      const nodeType = window.LiteGraph!.registered_node_types[nodeTypeName]
      const onNodeCreated = nodeType.prototype.onNodeCreated
      nodeType.prototype.onNodeCreated = function (...args) {
        onNodeCreated?.apply(this, args)
        this.serialize_widgets = true
        this.addWidget('string', first, 'first default', () => {})
        const added = this.addWidget(
          'string',
          second,
          'second default',
          () => {}
        )
        if (pinSecondAs === undefined) return
        Object.defineProperty(added, 'name', {
          value: pinSecondAs,
          writable: false,
          configurable: false
        })
        if (third !== undefined) {
          this.addWidget('string', third, 'third default', () => {})
        }
      }
    },
    { nodeTypeName: NODE_TYPE, ...widgets }
  )
  const nodeId = await comfyPage.searchBoxV2.addNodeAndGetId(
    'Node With Output List'
  )
  return { node: comfyPage.vueNodes.getNodeLocator(nodeId), nodeId }
}

function widgetRowsNamed(
  comfyPage: ComfyPage,
  scope: Locator | Page,
  name: string
): Locator {
  return scope.getByTestId(TestIds.widgets.widget).filter({
    has: comfyPage.page
      .getByTestId(TestIds.widgets.layoutFieldLabel)
      .and(comfyPage.page.getByText(name, { exact: true }))
  })
}

async function saveWidgetValues(
  comfyPage: ComfyPage,
  workflowName: string
): Promise<unknown> {
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
  return saved.nodes.find(({ type }) => type === NODE_TYPE)?.widgets_values
}

test.describe(
  'unique widget names',
  { tag: ['@canvas', '@widget', '@vue-nodes'] },
  () => {
    test('refuses the widget it cannot name uniquely and keeps the node usable', async ({
      comfyPage,
      workflowName
    }) => {
      const { node } = await addNodeWithWidgets(comfyPage, {
        first: 'duplicate',
        second: 'second',
        pinSecondAs: 'duplicate'
      })
      const duplicateRows = widgetRowsNamed(comfyPage, node, 'duplicate')

      await test.step('the canvas shows one widget under the name, not two', async () => {
        await expect(duplicateRows).toHaveCount(1)
      })

      await test.step('what the user types is what the app saves', async () => {
        const input = duplicateRows.locator('input')
        await input.fill('typed by the user')
        await input.blur()

        expect(await saveWidgetValues(comfyPage, workflowName)).toEqual([
          'typed by the user'
        ])
      })

      await test.step('and it is still there after closing and reopening', async () => {
        await comfyPage.workflow.newBlankWorkflow()
        await comfyPage.menu.topbar.closeWorkflowTab(workflowName)
        await openWorkflowFromSidebar(comfyPage, workflowName)

        const reopened = widgetRowsNamed(comfyPage, comfyPage.page, 'duplicate')
        await expect(reopened).toHaveCount(1)
        await expect(reopened.locator('input')).toHaveValue('typed by the user')
      })
    })

    test('renames a duplicate formed while the node was detached when it rejoins', async ({
      comfyPage,
      workflowName
    }) => {
      const { node, nodeId } = await addNodeWithWidgets(comfyPage, {
        first: 'alpha',
        second: 'beta'
      })
      await expect(node.getByTestId(TestIds.widgets.widget)).toHaveCount(2)

      await comfyPage.page.evaluate((id) => {
        const graph = window.app!.graph
        const added = graph.nodes.find(
          (candidate) => String(candidate.id) === id
        )
        const beta = added?.widgets?.find(({ name }) => name === 'beta')
        if (!added || !beta) throw new Error(`node ${id} has no beta widget`)
        graph.remove(added)
        beta.name = 'alpha'
        graph.add(added)
      }, nodeId)

      await test.step('both widgets are still drawn after the re-add', async () => {
        await expect(widgetRowsNamed(comfyPage, node, 'alpha')).toHaveCount(1)
        await expect(widgetRowsNamed(comfyPage, node, 'alpha#1')).toHaveCount(1)
      })

      await test.step('and the node saves both values', async () => {
        expect(await saveWidgetValues(comfyPage, workflowName)).toEqual([
          'first default',
          'second default'
        ])
      })
    })

    test('keeps a surviving sibling value through duplicate refusal and reload', async ({
      comfyPage,
      workflowName
    }) => {
      const { nodeId } = await addNodeWithWidgets(comfyPage, {
        first: 'a',
        second: 'duplicate',
        third: 'b',
        pinSecondAs: 'a'
      })
      const workflow = await comfyPage.workflow.getExportedWorkflow()
      const savedNode = workflow.nodes.find(({ id }) => String(id) === nodeId)
      if (!savedNode) throw new Error(`node ${nodeId} was not exported`)
      savedNode.widgets_values = ['saved-a', 'saved-duplicate', 'saved-b']
      savedNode.widgets_values_named = {
        a: 'saved-duplicate',
        b: 'saved-b'
      }

      await comfyPage.page.evaluate(() => {
        window.LiteGraph!.namedValuesRestore = false
      })
      await comfyPage.workflow.loadGraphData(workflow)

      const siblingInput = widgetRowsNamed(
        comfyPage,
        comfyPage.page,
        'b'
      ).locator('input')
      await expect(siblingInput).toHaveValue('saved-b')
      expect(await saveWidgetValues(comfyPage, workflowName)).toEqual([
        'saved-a',
        'saved-b'
      ])

      await comfyPage.workflow.newBlankWorkflow()
      await comfyPage.menu.topbar.closeWorkflowTab(workflowName)
      await openWorkflowFromSidebar(comfyPage, workflowName)

      await expect(
        widgetRowsNamed(comfyPage, comfyPage.page, 'b').locator('input')
      ).toHaveValue('saved-b')
    })
  }
)
