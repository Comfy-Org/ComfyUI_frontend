import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { executionFixture as test } from '@e2e/fixtures/execution'
import { imageOutput } from '@e2e/fixtures/helpers/ExecutionHelper'

const KSAMPLER_NODE = '3'
const SAVE_IMAGE_NODE = '9'
const WORKFLOW_A = 'exec_leak_a'
const WORKFLOW_B = 'exec_leak_b'
const WORKFLOW_A_COPY = 'pasted_twin'

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
    execution: exec,
    backendSimulator: simulator
  }) => {
    const workflowAId = await comfyPage.workflow.getActiveWorkflowId()

    const jobId = await exec.run()
    const running = simulator.prompt(jobId, { workflowId: workflowAId })
    simulator.play([
      running.start(),
      ...running.nodeRunning(KSAMPLER_NODE, 1, 4)
    ])

    await comfyPage.workflow.openPersistedWorkflow(WORKFLOW_B)
    const tabA = comfyPage.menu.topbar.getWorkflowTab(WORKFLOW_A)

    simulator.play([
      running.executed(SAVE_IMAGE_NODE, imageOutput('a.png')),
      running.success()
    ])
    await expect(tabA.getByRole('img', { name: 'Completed' })).toBeVisible()
    await expect(tabA.getByRole('img', { name: 'Running' })).toHaveCount(0)

    await comfyPage.workflow.switchToTab(WORKFLOW_A)

    await expect(
      comfyPage.menu.topbar.workflowTabs.getByRole('img', { name: 'Running' })
    ).toHaveCount(0)
  })

  test('the node the user is looking at does not take over a foreign run', async ({
    comfyPage,
    execution: exec,
    backendSimulator: simulator
  }) => {
    const workflowAId = await comfyPage.workflow.getActiveWorkflowId()

    const jobId = await exec.run()
    const running = simulator.prompt(jobId, { workflowId: workflowAId })
    simulator.play([
      running.start(),
      ...running.nodeRunning(KSAMPLER_NODE, 1, 4)
    ])
    await expect
      .poll(() => comfyPage.nodeOps.getExecutionRender(KSAMPLER_NODE))
      .toEqual({ progress: 0.25, outlined: true })

    await comfyPage.workflow.openPersistedWorkflow(WORKFLOW_B)

    expect(await comfyPage.nodeOps.getExecutionRender(KSAMPLER_NODE)).toEqual({
      progress: null,
      outlined: false
    })

    simulator.play([...running.nodeRunning(KSAMPLER_NODE, 3, 4)])

    await comfyPage.workflow.switchToTab(WORKFLOW_A)

    await expect
      .poll(() => comfyPage.nodeOps.getExecutionRender(KSAMPLER_NODE))
      .toEqual({ progress: 0.75, outlined: true })

    await comfyPage.workflow.switchToTab(WORKFLOW_B)
    expect(await comfyPage.nodeOps.getExecutionRender(KSAMPLER_NODE)).toEqual({
      progress: null,
      outlined: false
    })
  })

  test('stays clean across repeated switches during one run', async ({
    comfyPage,
    execution: exec,
    backendSimulator: simulator
  }) => {
    const workflowAId = await comfyPage.workflow.getActiveWorkflowId()

    const jobId = await exec.run()
    const running = simulator.prompt(jobId, { workflowId: workflowAId })
    simulator.play([running.start()])

    await comfyPage.workflow.openPersistedWorkflow(WORKFLOW_B)

    async function switchAndAssert(step: number, arrival: number) {
      await comfyPage.workflow.switchToTab(WORKFLOW_A)
      simulator.play([...running.nodeRunning(KSAMPLER_NODE, step, 10)])
      await expect
        .poll(() => comfyPage.nodeOps.getExecutionRender(KSAMPLER_NODE))
        .toEqual({ progress: step / 10, outlined: true })

      await comfyPage.workflow.switchToTab(WORKFLOW_B)
      expect(
        await comfyPage.nodeOps.getExecutionRender(KSAMPLER_NODE),
        `arrival ${arrival} in B must not inherit A`
      ).toEqual({ progress: null, outlined: false })
    }

    await switchAndAssert(3, 1)
    await switchAndAssert(7, 2)
  })

  test('stays clean while the visible workflow is queued behind the running one', async ({
    comfyPage,
    execution: exec,
    backendSimulator: simulator
  }) => {
    const workflowAId = await comfyPage.workflow.getActiveWorkflowId()

    const jobA = await exec.run()
    const running = simulator.prompt(jobA, { workflowId: workflowAId })
    simulator.play([
      running.start(),
      ...running.nodeRunning(KSAMPLER_NODE, 1, 4)
    ])

    await comfyPage.workflow.openPersistedWorkflow(WORKFLOW_B)

    await exec.run()
    expect(await comfyPage.nodeOps.getExecutionRender(KSAMPLER_NODE)).toEqual({
      progress: null,
      outlined: false
    })

    simulator.play([...running.nodeRunning(KSAMPLER_NODE, 3, 4)])
    await comfyPage.workflow.switchToTab(WORKFLOW_A)
    await expect
      .poll(() => comfyPage.nodeOps.getExecutionRender(KSAMPLER_NODE))
      .toEqual({ progress: 0.75, outlined: true })
    await comfyPage.workflow.switchToTab(WORKFLOW_B)
    expect(await comfyPage.nodeOps.getExecutionRender(KSAMPLER_NODE)).toEqual({
      progress: null,
      outlined: false
    })
  })

  test('a second open workflow sharing the workflow id does not receive the output', async ({
    comfyPage,
    execution: exec,
    backendSimulator: simulator
  }) => {
    const sharedId = await comfyPage.workflow.getActiveWorkflowId()

    const jobId = await exec.run()
    const running = simulator.prompt(jobId, { workflowId: sharedId })
    simulator.play([running.start()])

    await comfyPage.workflow.openPersistedWorkflow(WORKFLOW_A_COPY)
    expect(
      await comfyPage.workflow.getActiveWorkflowId(),
      'the copy must carry the same id, which is what makes this reachable'
    ).toBe(sharedId)

    simulator.play([
      ...running.nodeRunning(KSAMPLER_NODE, 2, 4),
      running.executed(SAVE_IMAGE_NODE, imageOutput('from-the-original.png')),
      running.success()
    ])

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
    expect(await comfyPage.nodeOps.getExecutionRender(KSAMPLER_NODE)).toEqual({
      progress: null,
      outlined: false
    })
  })
})
