import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  BackendSimulator,
  duplicateFrame,
  interleave,
  swapFrames
} from '@e2e/fixtures/helpers/BackendSimulator'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'
import type { WorkspaceStore } from '@e2e/types/globals'

/**
 * Execution WebSocket frames must only move the visible workflow's UI.
 *
 * Every scenario here is a frame script rather than a timing race: the backend
 * is simulated by {@link BackendSimulator}, so "a frame from the other tab
 * arrives between this tab's progress and its terminal frame" is an ordered
 * list, not a sleep. See `BackendSimulator.test.ts` for the harness's own
 * tests.
 *
 * Every scenario loads a workflow that carries an `id`. Ownership gating has
 * nothing to resolve for an unsaved workflow — no id on the message's side to
 * compare against, and no queue-time mapping — so it stays deliberately
 * permissive there, and a foreign-frame assertion would pass for the wrong
 * reason. `assets/default.json` has no id, which is why these use
 * `assets/execution/workflow_with_id.json`.
 */

const test = mergeTests(comfyPageFixture, webSocketFixture)

const KSAMPLER_NODE = '3'
const SAVE_IMAGE_NODE = '9'
const FOREIGN_WORKFLOW_ID = '0199e3a3-6c01-7000-8000-ffffffffffff'
/** Carries `id`, unlike `assets/default.json`. See the describe block comment. */
const WORKFLOW_WITH_ID = 'execution/workflow_with_id'

function imageOutput(filename: string) {
  return {
    images: [{ filename, subfolder: '', type: 'output' }]
  }
}

/** The id the gate compares against; undefined for an unsaved workflow. */
async function activeWorkflowId(
  comfyPage: ComfyPage
): Promise<string | undefined> {
  return comfyPage.page.evaluate(() => {
    const workflow = (window.app!.extensionManager as WorkspaceStore).workflow
      .activeWorkflow
    return workflow?.activeState.id ?? workflow?.initialState.id ?? undefined
  })
}

test.describe('workflow-scoped execution', { tag: '@ui' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow(WORKFLOW_WITH_ID)
    await comfyPage.appMode.enterAppModeWithInputs([[KSAMPLER_NODE, 'seed']])
    await expect(comfyPage.appMode.linearWidgets).toBeVisible()
  })

  test('renders the visible workflow own frames', async ({
    comfyPage,
    getWebSocket
  }) => {
    const exec = new ExecutionHelper(comfyPage, await getWebSocket())
    const simulator = new BackendSimulator(exec)
    const jobId = await exec.run()
    await comfyPage.nextFrame()

    const mine = simulator.prompt(jobId, {
      workflowId: await activeWorkflowId(comfyPage)
    })
    simulator.play([mine.start(), mine.nodeRunning(KSAMPLER_NODE, 1, 4)])

    await expect(
      comfyPage.appMode.outputHistory.inProgressItems.first()
    ).toBeVisible()

    simulator.play([
      mine.executed(SAVE_IMAGE_NODE, imageOutput('mine.png')),
      mine.success()
    ])

    await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(1)
  })

  test('a frame from another workflow does not start the visible tab', async ({
    comfyPage,
    getWebSocket
  }) => {
    const exec = new ExecutionHelper(comfyPage, await getWebSocket())
    const simulator = new BackendSimulator(exec)
    const workflowId = await activeWorkflowId(comfyPage)
    expect(workflowId, 'the loaded workflow must carry an id').toBeDefined()

    const foreign = simulator.prompt('foreign-job', {
      workflowId: FOREIGN_WORKFLOW_ID
    })
    simulator.play([
      foreign.start(),
      foreign.nodeRunning(KSAMPLER_NODE, 1, 4),
      foreign.executing(KSAMPLER_NODE)
    ])

    await expect(comfyPage.appMode.outputHistory.inProgressItems).toHaveCount(0)
    await expect(comfyPage.appMode.outputHistory.skeletons).toHaveCount(0)
  })

  test('an output from another workflow does not land on the visible tab', async ({
    comfyPage,
    getWebSocket
  }) => {
    const exec = new ExecutionHelper(comfyPage, await getWebSocket())
    const simulator = new BackendSimulator(exec)
    const workflowId = await activeWorkflowId(comfyPage)
    expect(workflowId, 'the loaded workflow must carry an id').toBeDefined()

    const jobId = await exec.run()
    await comfyPage.nextFrame()
    const mine = simulator.prompt(jobId, { workflowId })
    const foreign = simulator.prompt('foreign-job', {
      workflowId: FOREIGN_WORKFLOW_ID
    })

    simulator.play([
      mine.start(),
      foreign.start(),
      foreign.executed(SAVE_IMAGE_NODE, imageOutput('theirs.png')),
      foreign.success(),
      mine.executed(SAVE_IMAGE_NODE, imageOutput('mine.png')),
      mine.success()
    ])

    await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(1)
  })

  test('interleaved prompts keep the visible tab on its own run', async ({
    comfyPage,
    getWebSocket
  }) => {
    const exec = new ExecutionHelper(comfyPage, await getWebSocket())
    const simulator = new BackendSimulator(exec)
    const workflowId = await activeWorkflowId(comfyPage)
    expect(workflowId, 'the loaded workflow must carry an id').toBeDefined()

    const jobId = await exec.run()
    await comfyPage.nextFrame()
    const mine = simulator.prompt(jobId, { workflowId })
    const foreign = simulator.prompt('foreign-job', {
      workflowId: FOREIGN_WORKFLOW_ID
    })

    // Seed 11 fixes the order; it is printed here so a failure is reproducible.
    simulator.play(
      interleave(
        [
          mine.start(),
          mine.nodeRunning(KSAMPLER_NODE, 1, 4),
          mine.executed(SAVE_IMAGE_NODE, imageOutput('mine.png')),
          mine.success()
        ],
        [
          foreign.start(),
          foreign.nodeRunning(KSAMPLER_NODE, 3, 4),
          foreign.executed(SAVE_IMAGE_NODE, imageOutput('theirs.png')),
          foreign.success()
        ],
        11
      )
    )

    await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(1)
  })

  test('an output that arrives after the terminal frame still renders', async ({
    comfyPage,
    getWebSocket
  }) => {
    const exec = new ExecutionHelper(comfyPage, await getWebSocket())
    const simulator = new BackendSimulator(exec)
    const jobId = await exec.run()
    await comfyPage.nextFrame()

    const workflowId = await activeWorkflowId(comfyPage)
    const mine = simulator.prompt(jobId, { workflowId })
    const script = [
      mine.start(),
      mine.executed(SAVE_IMAGE_NODE, imageOutput('mine.png')),
      mine.success()
    ]
    const label = workflowId ?? jobId

    simulator.play(
      swapFrames(script, `${label}:executed`, `${label}:execution_success`)
    )

    await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(1)
  })

  test('a repeated terminal frame does not duplicate the output', async ({
    comfyPage,
    getWebSocket
  }) => {
    const exec = new ExecutionHelper(comfyPage, await getWebSocket())
    const simulator = new BackendSimulator(exec)
    const jobId = await exec.run()
    await comfyPage.nextFrame()

    const workflowId = await activeWorkflowId(comfyPage)
    const mine = simulator.prompt(jobId, { workflowId })
    const script = [
      mine.start(),
      mine.executed(SAVE_IMAGE_NODE, imageOutput('mine.png')),
      mine.success()
    ]

    simulator.play(
      duplicateFrame(script, `${workflowId ?? jobId}:execution_success`)
    )

    await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(1)
  })

  test('a backend that sends no workflow id behaves as before', async ({
    comfyPage,
    getWebSocket
  }) => {
    const exec = new ExecutionHelper(comfyPage, await getWebSocket())
    const simulator = new BackendSimulator(exec)
    const jobId = await exec.run()
    await comfyPage.nextFrame()

    // No workflowId: every frame is emitted the way a core build without
    // `workflow_metadata` emits it. This is the control for the 90% of users
    // whose server has not been updated.
    const legacy = simulator.prompt(jobId)
    simulator.play([legacy.start(), legacy.nodeRunning(KSAMPLER_NODE, 1, 4)])

    await expect(
      comfyPage.appMode.outputHistory.inProgressItems.first()
    ).toBeVisible()

    simulator.play([
      legacy.executed(SAVE_IMAGE_NODE, imageOutput('mine.png')),
      legacy.success()
    ])

    await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(1)
    await expect(comfyPage.appMode.outputHistory.skeletons).toHaveCount(0)
  })
})
