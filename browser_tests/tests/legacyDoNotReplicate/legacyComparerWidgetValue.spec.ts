import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { openWorkflowFromSidebar } from '@e2e/fixtures/utils/builderTestUtils'
import {
  expectNoVisibleErrors,
  trackVisibleErrors
} from '@e2e/fixtures/utils/errorSurfaces'

const NODE_TYPE = 'DevToolsNodeWithComparerWidget'
const WORKFLOW_NAME = 'legacy-comparer'

const SERIALISED_IMAGES = [
  { name: 'A', selected: true, url: '/devtools/comparer/a.png' },
  { name: 'B', selected: true, url: '/devtools/comparer/b.png' }
]

async function exportedComparerWidgetValue(
  comfyPage: ComfyPage
): Promise<unknown> {
  const workflow = await comfyPage.workflow.getExportedWorkflow()
  const values = workflow.nodes.find(
    (node) => node.type === NODE_TYPE
  )?.widgets_values
  return Array.isArray(values) ? values[0] : values
}

test.describe('Legacy comparer widget', { tag: ['@widget', '@ui'] }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({})
  })

  test('serialises after the workflow is saved and reopened', async ({
    comfyPage
  }) => {
    test.slow()
    await trackVisibleErrors(comfyPage.page)
    await comfyPage.nodeOps.clearGraph()
    await expect
      .poll(
        () =>
          comfyPage.page.evaluate(
            (type) => Boolean(window.LiteGraph?.registered_node_types[type]),
            NODE_TYPE
          ),
        {
          message: `${NODE_TYPE} is not registered - ComfyUI_devtools is not installed on this backend`
        }
      )
      .toBe(true)
    await comfyPage.nodeOps.addNode(NODE_TYPE)

    await comfyPage.menu.topbar.saveWorkflow(WORKFLOW_NAME)
    await openWorkflowFromSidebar(comfyPage, WORKFLOW_NAME)

    await expect
      .poll(() => exportedComparerWidgetValue(comfyPage))
      .toEqual(SERIALISED_IMAGES)

    await comfyPage.workflow.loadWorkflow('default')

    await expectNoVisibleErrors(
      comfyPage.page,
      'after switching away from the reopened comparer workflow'
    )
  })
})
