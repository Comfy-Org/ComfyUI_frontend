import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { executionFixture as test } from '@e2e/fixtures/execution'
import {
  BackendSimulator,
  duplicateFrames,
  interleave,
  swapFrames
} from '@e2e/fixtures/helpers/BackendSimulator'
import {
  ExecutionHelper,
  imageOutput
} from '@e2e/fixtures/helpers/ExecutionHelper'

const KSAMPLER_NODE = '3'
const SAVE_IMAGE_NODE = '9'
const FOREIGN_WORKFLOW_ID = '0199e3a3-6c01-7000-8000-ffffffffffff'
const WORKFLOW_WITH_ID = 'execution/workflow_with_id'

test.describe('workflow-scoped execution', { tag: '@ui' }, () => {
  let workflowId: string

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow(WORKFLOW_WITH_ID)
    await comfyPage.appMode.enterAppModeWithInputs([[KSAMPLER_NODE, 'seed']])
    await expect(comfyPage.appMode.linearWidgets).toBeVisible()
    const loadedWorkflowId = await comfyPage.workflow.getActiveWorkflowId()
    if (!loadedWorkflowId) throw new Error('loaded workflow has no id')
    workflowId = loadedWorkflowId
  })

  test('renders the visible workflow own frames', async ({
    comfyPage,
    execution: exec,
    backendSimulator: simulator
  }) => {
    const jobId = await exec.run()
    await comfyPage.nextFrame()

    const mine = simulator.prompt(jobId, { workflowId })
    simulator.play([mine.start(), ...mine.nodeRunning(KSAMPLER_NODE, 1, 4)])

    await expect(
      comfyPage.appMode.outputHistory.inProgressItems.first()
    ).toBeVisible()

    simulator.play([
      mine.executed(SAVE_IMAGE_NODE, imageOutput('mine.png')),
      mine.success()
    ])

    await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(1)
  })

  test('an output from another workflow does not land on the visible tab', async ({
    comfyPage,
    execution: exec,
    backendSimulator: simulator
  }) => {
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
    execution: exec,
    backendSimulator: simulator
  }) => {
    const jobId = await exec.run()
    await comfyPage.nextFrame()
    const mine = simulator.prompt(jobId, { workflowId })
    const foreign = simulator.prompt('foreign-job', {
      workflowId: FOREIGN_WORKFLOW_ID
    })

    simulator.play(
      interleave(
        [
          mine.start(),
          ...mine.nodeRunning(KSAMPLER_NODE, 1, 4),
          mine.executed(SAVE_IMAGE_NODE, imageOutput('mine.png')),
          mine.success()
        ],
        [
          foreign.start(),
          ...foreign.nodeRunning(KSAMPLER_NODE, 3, 4),
          foreign.executed(SAVE_IMAGE_NODE, imageOutput('theirs.png')),
          foreign.success()
        ],
        2
      )
    )

    await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(1)
    await expect(
      comfyPage.appMode.outputHistory.imageOutputs.first()
    ).toHaveAttribute('src', /mine\.png/)
  })

  test('an output that arrives after the terminal frame is ignored', async ({
    comfyPage,
    execution: exec,
    backendSimulator: simulator
  }) => {
    const jobId = await exec.run()
    await comfyPage.nextFrame()

    const mine = simulator.prompt(jobId, { workflowId })
    const script = [
      mine.start(),
      mine.executed(SAVE_IMAGE_NODE, imageOutput('mine.png')),
      mine.success()
    ]
    const label = workflowId

    simulator.play(
      swapFrames(script, `${label}:executed`, `${label}:execution_success`)
    )
    await comfyPage.nextFrame()

    await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(0)
    await expect(comfyPage.appMode.outputHistory.skeletons).toHaveCount(0)
  })

  test('a repeated terminal frame does not duplicate the output', async ({
    comfyPage,
    execution: exec,
    backendSimulator: simulator
  }) => {
    const jobId = await exec.run()
    await comfyPage.nextFrame()

    const mine = simulator.prompt(jobId, { workflowId })
    const script = [
      mine.start(),
      mine.executed(SAVE_IMAGE_NODE, imageOutput('mine.png')),
      mine.success()
    ]

    simulator.play(duplicateFrames(script, `${workflowId}:execution_success`))

    await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(1)
  })

  test('a backend that sends no workflow id behaves as before', async ({
    comfyPage,
    execution: exec,
    backendSimulator: simulator
  }) => {
    const jobId = await exec.run()
    await comfyPage.nextFrame()

    const legacy = simulator.prompt(jobId)
    const foreign = simulator.prompt('foreign-job')
    simulator.play([
      legacy.start(),
      foreign.start(),
      ...foreign.nodeRunning(KSAMPLER_NODE, 3, 4),
      foreign.success(),
      ...legacy.nodeRunning(KSAMPLER_NODE, 1, 4)
    ])

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

  test('another workflow finishing does not end the visible run', async ({
    comfyPage,
    execution: exec,
    backendSimulator: simulator
  }) => {
    const jobId = await exec.run()
    await comfyPage.nextFrame()
    const mine = simulator.prompt(jobId, { workflowId })
    const foreign = simulator.prompt('foreign-job', {
      workflowId: FOREIGN_WORKFLOW_ID
    })

    simulator.play([mine.start(), ...mine.nodeRunning(KSAMPLER_NODE, 1, 4)])
    await expect(
      comfyPage.appMode.outputHistory.inProgressItems.first()
    ).toBeVisible()

    simulator.play([
      foreign.start(),
      foreign.executing(null),
      foreign.success()
    ])

    await expect(
      comfyPage.appMode.outputHistory.inProgressItems.first()
    ).toBeVisible()

    simulator.play([
      mine.executed(SAVE_IMAGE_NODE, imageOutput('mine.png')),
      mine.success()
    ])

    await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(1)
  })

  test('a reconnect mid-run does not duplicate the output', async ({
    comfyPage,
    getWebSocket,
    nextWebSocket,
    execution: exec,
    backendSimulator: simulator
  }) => {
    const ws = await getWebSocket()
    const jobId = await exec.run()
    await comfyPage.nextFrame()
    const mine = simulator.prompt(jobId, { workflowId })
    simulator.play([mine.start(), ...mine.nodeRunning(KSAMPLER_NODE, 1, 4)])
    await expect(
      comfyPage.appMode.outputHistory.inProgressItems.first()
    ).toBeVisible()

    simulator.play([mine.executed(SAVE_IMAGE_NODE, imageOutput('mine.png'))])

    const reconnected = nextWebSocket()
    await ws.close()
    const nextRoute = await reconnected
    const afterReconnect = new BackendSimulator(
      new ExecutionHelper(comfyPage, nextRoute)
    ).prompt(jobId, { workflowId })

    afterReconnect.executed(SAVE_IMAGE_NODE, imageOutput('mine.png')).send()
    afterReconnect.success().send()

    await expect(comfyPage.appMode.outputHistory.imageOutputs).toHaveCount(1)
  })

  test('a binary preview for another workflow does not reach the visible tab', async ({
    comfyPage,
    execution: exec,
    backendSimulator: simulator
  }) => {
    const jobId = await exec.run()
    await comfyPage.nextFrame()
    const mine = simulator.prompt(jobId, { workflowId })
    const foreign = simulator.prompt('foreign-job', {
      workflowId: FOREIGN_WORKFLOW_ID
    })

    simulator.play([mine.start(), ...mine.nodeRunning(KSAMPLER_NODE, 1, 4)])

    simulator.play([foreign.latentPreview(KSAMPLER_NODE)])
    await comfyPage.nextFrame()

    simulator.play([mine.latentPreview(KSAMPLER_NODE)])
    await comfyPage.nextFrame()
    await expect(comfyPage.appMode.outputHistory.latentPreviews).toHaveCount(1)
    expect(
      await comfyPage.page.evaluate(
        () => Object.values(window.app!.nodePreviewImages).flat().length
      )
    ).toBeGreaterThan(0)
  })
})
