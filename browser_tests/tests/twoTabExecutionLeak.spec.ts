import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { BackendSimulator } from '@e2e/fixtures/helpers/BackendSimulator'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'
import { toNodeId } from '@/types/nodeId'
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
const WORKFLOW_A_COPY = 'pasted_twin'

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

async function canvasNodeRender(comfyPage: ComfyPage, nodeId: string) {
  return comfyPage.page.evaluate((id) => {
    const node = window.app!.graph.getNodeById(id)
    if (!node) return null
    const stroke = node.strokeStyles['running']?.call(node)
    return { progress: node.progress ?? null, outlined: stroke !== undefined }
  }, toNodeId(nodeId))
}

test.describe('cross-tab execution leak', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.setupWorkflowsDirectory({
      [`${WORKFLOW_A}.json`]: 'execution/workflow_with_id.json',
      [`${WORKFLOW_B}.json`]: 'execution/workflow_with_id_b.json',
      // The same asset under a second name: two files carrying one workflow
      // id, which is what a copy-paste into a new tab produces.
      [`${WORKFLOW_A_COPY}.json`]: 'execution/workflow_with_id.json'
    })
    await comfyPage.workflow.openPersistedWorkflow(WORKFLOW_A)
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
    simulator.play([
      running.start(),
      ...running.nodeRunning(KSAMPLER_NODE, 1, 4)
    ])

    await comfyPage.workflow.openPersistedWorkflow(WORKFLOW_B)
    const tabA = comfyPage.menu.topbar.getWorkflowTab(WORKFLOW_A)

    // Terminal frames arrive while tab A is in the background. That is the
    // stuck-progress report: the run must reach its end, not stay Running.
    simulator.play([
      running.executed(SAVE_IMAGE_NODE, imageOutput('a.png')),
      running.success()
    ])
    await expect(tabA.getByRole('img', { name: 'Completed' })).toBeVisible()
    await expect(tabA.getByRole('img', { name: 'Running' })).toHaveCount(0)

    await comfyPage.workflow.switchToTab(WORKFLOW_A)

    // An active tab deliberately carries no status badge (WorkflowTab.vue:235
    // — the user is already looking at it), so the absence of Completed here
    // proves nothing. What must hold is that nothing anywhere still reads as
    // running once the run has ended.
    await expect(
      comfyPage.menu.topbar.workflowTabs.getByRole('img', { name: 'Running' })
    ).toHaveCount(0)
  })

  test('the node the user is looking at does not take over a foreign run', async ({
    comfyPage,
    getWebSocket
  }) => {
    const exec = new ExecutionHelper(comfyPage, await getWebSocket())
    const simulator = new BackendSimulator(exec)
    const workflowAId = await activeWorkflowId(comfyPage)

    const jobId = await exec.run()
    await comfyPage.nextFrame()
    const running = simulator.prompt(jobId, { workflowId: workflowAId })
    simulator.play([
      running.start(),
      ...running.nodeRunning(KSAMPLER_NODE, 1, 4)
    ])
    await comfyPage.nextFrame()

    // Both workflows own a KSampler numbered 3, which is what makes this
    // reachable: node progress is keyed by a locator resolved against the
    // graph that happens to be in front, so A's entry lands on B's node.
    await expect
      .poll(() => canvasNodeRender(comfyPage, KSAMPLER_NODE))
      .toEqual({ progress: 0.25, outlined: true })

    await comfyPage.workflow.openPersistedWorkflow(WORKFLOW_B)
    await comfyPage.nextFrame()

    expect(await canvasNodeRender(comfyPage, KSAMPLER_NODE)).toEqual({
      progress: null,
      outlined: false
    })

    // A keeps running out of sight; none of it may surface on B.
    simulator.play([...running.nodeRunning(KSAMPLER_NODE, 3, 4)])
    await comfyPage.nextFrame()
    expect(await canvasNodeRender(comfyPage, KSAMPLER_NODE)).toEqual({
      progress: null,
      outlined: false
    })

    await comfyPage.workflow.switchToTab(WORKFLOW_A)
    await comfyPage.nextFrame()

    // Returning to A shows where its run actually got to, not where it was
    // when the user left.
    await expect
      .poll(() => canvasNodeRender(comfyPage, KSAMPLER_NODE))
      .toEqual({ progress: 0.75, outlined: true })
  })

  test('stays clean across repeated switches during one run', async ({
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
    await comfyPage.nextFrame()

    // Round 2 of the GPU QA: the first arrival in B was clean and later ones
    // were not, so one switch proves nothing here.
    for (const [index, step] of [3, 5, 7, 9].entries()) {
      await comfyPage.workflow.switchToTab(WORKFLOW_A)
      await comfyPage.nextFrame()
      simulator.play([...running.nodeRunning(KSAMPLER_NODE, step, 10)])
      await comfyPage.nextFrame()
      await expect
        .poll(() => canvasNodeRender(comfyPage, KSAMPLER_NODE))
        .toEqual({ progress: step / 10, outlined: true })

      await comfyPage.workflow.switchToTab(WORKFLOW_B)
      await comfyPage.nextFrame()
      expect(
        await canvasNodeRender(comfyPage, KSAMPLER_NODE),
        `arrival ${index + 1} in B must not inherit A`
      ).toEqual({ progress: null, outlined: false })
    }
  })

  test('stays clean while the visible workflow is queued behind the running one', async ({
    comfyPage,
    getWebSocket
  }) => {
    const exec = new ExecutionHelper(comfyPage, await getWebSocket())
    const simulator = new BackendSimulator(exec)
    const workflowAId = await activeWorkflowId(comfyPage)

    const jobA = await exec.run()
    await comfyPage.nextFrame()
    const running = simulator.prompt(jobA, { workflowId: workflowAId })
    simulator.play([
      running.start(),
      ...running.nodeRunning(KSAMPLER_NODE, 1, 4)
    ])

    await comfyPage.workflow.openPersistedWorkflow(WORKFLOW_B)
    await comfyPage.nextFrame()

    // B is queued behind A and has not started. QA saw A's progress land on
    // B's KSampler the moment B was queued.
    await exec.run()
    await comfyPage.nextFrame()
    expect(await canvasNodeRender(comfyPage, KSAMPLER_NODE)).toEqual({
      progress: null,
      outlined: false
    })

    simulator.play([...running.nodeRunning(KSAMPLER_NODE, 3, 4)])
    await comfyPage.nextFrame()
    expect(await canvasNodeRender(comfyPage, KSAMPLER_NODE)).toEqual({
      progress: null,
      outlined: false
    })
  })

  // QA on the core PR thread: copy a workflow, paste it into a new tab, run
  // both. `ensureWorkflowId` keeps the id already in the pasted json, so the
  // two tabs share one workflow id while being different open workflows, and
  // the node ids are identical too. Outputs landed on the wrong tab.
  test('a second open workflow sharing the workflow id does not receive the output', async ({
    comfyPage,
    getWebSocket
  }) => {
    const exec = new ExecutionHelper(comfyPage, await getWebSocket())
    const simulator = new BackendSimulator(exec)
    const sharedId = await activeWorkflowId(comfyPage)

    const jobId = await exec.run()
    await comfyPage.nextFrame()
    const running = simulator.prompt(jobId, { workflowId: sharedId })
    simulator.play([running.start()])

    await comfyPage.workflow.openPersistedWorkflow(WORKFLOW_A_COPY)
    await comfyPage.nextFrame()
    expect(
      await activeWorkflowId(comfyPage),
      'the copy must carry the same id, which is what makes this reachable'
    ).toBe(sharedId)

    simulator.play([
      ...running.nodeRunning(KSAMPLER_NODE, 2, 4),
      running.executed(SAVE_IMAGE_NODE, imageOutput('from-the-original.png')),
      running.success()
    ])

    // A positive marker before the absence checks. `WebSocketRoute.send` does
    // not await page-side handling and progress is coalesced per frame, so
    // reading straight after `play` can assert on state the frames have not
    // reached yet, and a gate that wrongly applied them would still pass. The
    // original's own tab reaching Completed is driven by the same terminal
    // frame, so polling it proves the batch was processed.
    await expect(
      comfyPage.menu.topbar
        .getWorkflowTab(WORKFLOW_A)
        .getByRole('img', { name: 'Completed' })
    ).toBeVisible()

    const leaked = await comfyPage.page.evaluate(() =>
      JSON.stringify(window.app!.nodeOutputs)
    )
    expect(
      leaked,
      'the original output must not land on the copy'
    ).not.toContain('from-the-original.png')
    expect(await canvasNodeRender(comfyPage, KSAMPLER_NODE)).toEqual({
      progress: null,
      outlined: false
    })
  })
})
