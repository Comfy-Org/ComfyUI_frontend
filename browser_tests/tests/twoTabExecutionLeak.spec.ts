import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { BackendSimulator } from '@e2e/fixtures/helpers/BackendSimulator'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'
import type { WorkspaceStore } from '@e2e/types/globals'

/**
 * The reported bug, with two real workflow tabs rather than simulated ones.
 *
 * `workflowScopedExecution.spec.ts` injects frames tagged with a foreign
 * workflow id, which exercises the gate but takes the frontend's own tab
 * bookkeeping on trust. These tests open two persisted workflows, queue from
 * one, switch to the other, and assert the second tab is untouched — the
 * actual sequence users reported.
 */

const test = mergeTests(comfyPageFixture, webSocketFixture)

const KSAMPLER_NODE = '3'
const SAVE_IMAGE_NODE = '9'
const WORKFLOW_A = 'exec_leak_a'
const WORKFLOW_B = 'exec_leak_b'

function imageOutput(filename: string) {
  return { images: [{ filename, subfolder: '', type: 'output' }] }
}

async function activeWorkflowId(
  comfyPage: ComfyPage
): Promise<string | undefined> {
  return comfyPage.page.evaluate(() => {
    const workflow = (window.app!.extensionManager as WorkspaceStore).workflow
      .activeWorkflow
    return workflow?.activeState.id ?? workflow?.initialState.id ?? undefined
  })
}

test.describe('cross-tab execution leak', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({
      [`${WORKFLOW_A}.json`]: 'execution/workflow_with_id.json',
      [`${WORKFLOW_B}.json`]: 'execution/workflow_with_id_b.json'
    })
    await comfyPage.workflow.openPersistedWorkflow(WORKFLOW_A)
  })

  test('a run in one tab leaves the other tab idle', async ({
    comfyPage,
    getWebSocket
  }) => {
    const exec = new ExecutionHelper(comfyPage, await getWebSocket())
    const simulator = new BackendSimulator(exec)

    const workflowAId = await activeWorkflowId(comfyPage)
    expect(workflowAId, 'workflow A must carry an id').toBeDefined()

    const jobId = await exec.run()
    await comfyPage.nextFrame()
    const running = simulator.prompt(jobId, { workflowId: workflowAId })
    simulator.play([running.start(), running.nodeRunning(KSAMPLER_NODE, 1, 4)])

    await comfyPage.workflow.openPersistedWorkflow(WORKFLOW_B)
    const workflowBId = await activeWorkflowId(comfyPage)
    expect(workflowBId, 'the second tab must be a different workflow').not.toBe(
      workflowAId
    )

    // Tab A's run continues while the user looks at tab B.
    simulator.play([
      running.nodeRunning(KSAMPLER_NODE, 3, 4),
      running.executed(SAVE_IMAGE_NODE, imageOutput('a.png')),
      running.success()
    ])

    // Per-tab state, read from the topbar badges: A owns the run, B never
    // shows one. Asserted rather than screenshotted — this is a state bug.
    const tabA = comfyPage.menu.topbar.getWorkflowTab(WORKFLOW_A)
    const tabB = comfyPage.menu.topbar.getWorkflowTab(WORKFLOW_B)
    await expect(tabB.getByRole('img', { name: 'Running' })).toHaveCount(0)
    await expect(tabA.getByRole('img', { name: 'Completed' })).toBeVisible()
    await expect(tabB.getByRole('img', { name: 'Completed' })).toHaveCount(0)
  })

  test('switching back shows the finished run, not a stuck one', async ({
    comfyPage,
    getWebSocket
  }) => {
    const exec = new ExecutionHelper(comfyPage, await getWebSocket())
    const simulator = new BackendSimulator(exec)
    const workflowAId = await activeWorkflowId(comfyPage)

    const jobId = await exec.run()
    await comfyPage.nextFrame()
    const running = simulator.prompt(jobId, { workflowId: workflowAId })
    simulator.play([running.start(), running.nodeRunning(KSAMPLER_NODE, 1, 4)])

    await comfyPage.workflow.openPersistedWorkflow(WORKFLOW_B)
    simulator.play([
      running.executed(SAVE_IMAGE_NODE, imageOutput('a.png')),
      running.success()
    ])
    await comfyPage.workflow.switchToTab(WORKFLOW_A)

    // The terminal frames arrived while this tab was in the background, which
    // is the stuck-progress report: nothing may still read as running.
    const tabA = comfyPage.menu.topbar.getWorkflowTab(WORKFLOW_A)
    await expect(tabA.getByRole('img', { name: 'Running' })).toHaveCount(0)
    await expect(tabA.getByRole('img', { name: 'Completed' })).toBeVisible()
    await expect(
      comfyPage.menu.topbar
        .getWorkflowTab(WORKFLOW_B)
        .getByRole('img', { name: 'Running' })
    ).toHaveCount(0)
  })

  test('the background tab records its own run while the other is visible', async ({
    comfyPage,
    getWebSocket
  }) => {
    const exec = new ExecutionHelper(comfyPage, await getWebSocket())
    const simulator = new BackendSimulator(exec)
    const workflowAId = await activeWorkflowId(comfyPage)

    const jobId = await exec.run()
    await comfyPage.nextFrame()
    const running = simulator.prompt(jobId, { workflowId: workflowAId })
    simulator.play([running.start()])

    await comfyPage.workflow.openPersistedWorkflow(WORKFLOW_B)
    simulator.play([running.success()])

    // The tab badge is per-workflow state, so it must still reach its terminal
    // mark while another tab is in front — the regression CI caught earlier.
    const tabA = comfyPage.menu.topbar.getWorkflowTab(WORKFLOW_A)
    await expect(tabA.getByRole('img', { name: 'Completed' })).toBeVisible()
    await expect(tabA.getByRole('img', { name: 'Running' })).toHaveCount(0)
  })
})
