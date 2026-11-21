import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { test } from '@e2e/fixtures/ecosystemSimulacraFixture'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'
import {
  activeRootId,
  addPreMatchTypeVhsUnbatch,
  connectUnbatchToPreview,
  heldTimerCount,
  latentPreviewWidgetsByOpenWorkflow,
  linkCountsByOpenWorkflow,
  queueUnbatchTypeChange,
  readEcosystemSimulacra,
  releaseHeldTimers,
  startLatentPreviewOnNode
} from '@e2e/fixtures/utils/ecosystemSimulacra'
import { switchToWorkflowTab } from '@e2e/fixtures/utils/legacyGraphInstancePatches'

test.describe('pre-MatchType VHS installed', { tag: '@canvas' }, () => {
  test.beforeEach(async ({ page }) => {
    await routeObjectInfoFromSetupApi(page, addPreMatchTypeVhsUnbatch)
  })

  test('warns once that VideoHelperSuite needs an update', async ({
    comfyPage
  }) => {
    const warning = comfyPage.toast.withText('Update ComfyUI-VideoHelperSuite')

    await expect(warning).toHaveCount(1)
  })
})

test.describe('VHS callbacks that read app.graph', { tag: '@canvas' }, () => {
  test.describe('pre-MatchType cloneType', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.newBlankWorkflow()
      await connectUnbatchToPreview(comfyPage)
      await comfyPage.workflow.newBlankWorkflow()
      await connectUnbatchToPreview(comfyPage)
      await expect
        .poll(() => linkCountsByOpenWorkflow(comfyPage))
        .toEqual([expect.any(Number), 2, 2])
    })

    test.fail(
      'a type change queued in one workflow leaves links of the workflow on screen alone',
      async ({ comfyPage }) => {
        await switchToWorkflowTab(comfyPage, 1)
        await queueUnbatchTypeChange(comfyPage, 'MASK')
        await expect.poll(() => heldTimerCount(comfyPage)).toBe(1)
        await switchToWorkflowTab(comfyPage, 2)

        await releaseHeldTimers(comfyPage)

        const [, owning, onScreen] = await linkCountsByOpenWorkflow(comfyPage)
        expect.soft(onScreen, 'workflow on screen keeps both links').toBe(2)
        expect
          .soft(owning, 'workflow that queued the change drops its output link')
          .toBe(1)
      }
    )
  })

  test.describe('VHS.LatentPreview cleanup', () => {
    test.fail(
      'turning the setting off removes preview widgets from every open workflow',
      async ({ comfyPage }) => {
        await comfyPage.settings.setSetting(
          'DevTools.Simulacra.LatentPreview',
          true
        )
        await comfyPage.workflow.newBlankWorkflow()
        const nodeId = String((await comfyPage.nodeOps.addNode('KSampler')).id)
        await startLatentPreviewOnNode(comfyPage, nodeId)
        await comfyPage.workflow.newBlankWorkflow()
        await comfyPage.nodeOps.addNode('KSampler')
        await startLatentPreviewOnNode(comfyPage, nodeId)
        await expect
          .poll(() => latentPreviewWidgetsByOpenWorkflow(comfyPage, nodeId))
          .toEqual([false, true, true])

        await comfyPage.settings.setSetting(
          'DevTools.Simulacra.LatentPreview',
          false
        )

        await expect
          .poll(() => latentPreviewWidgetsByOpenWorkflow(comfyPage, nodeId))
          .toEqual([false, false, false])
      }
    )
  })

  test.describe('executing listener', () => {
    test.fail(
      'a finished background job reaches the nodes of the workflow that queued it',
      async ({ comfyPage, getWebSocket }) => {
        await comfyPage.workflow.newBlankWorkflow()
        const queuedNode = await comfyPage.nodeOps.addNode('SaveImage')
        const queued = `${await activeRootId(comfyPage)}:${queuedNode.id}`
        const execution = new ExecutionHelper(comfyPage, await getWebSocket())
        const jobId = await execution.run()
        await comfyPage.workflow.newBlankWorkflow()
        await comfyPage.nodeOps.addNode('SaveImage')

        execution.executionStart(jobId)
        execution.executing(jobId, null)

        await expect
          .poll(
            async () => (await readEcosystemSimulacra(comfyPage)).promptExecuted
          )
          .toEqual([queued])
      }
    )
  })
})
