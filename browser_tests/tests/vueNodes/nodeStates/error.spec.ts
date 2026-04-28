import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import {
  cleanupFakeModel,
  dismissErrorOverlay,
  enableErrorsOverlay
} from '@e2e/fixtures/helpers/ErrorsTabHelper'
import {
  ExecutionHelper,
  buildKSamplerError
} from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const ERROR_CLASS = /ring-destructive-background/
const KSAMPLER_NODE_ID = '3'
const UNKNOWN_NODE_ID = '1'
const RAISE_ERROR_NODE_ID = '17'
const SUBGRAPH_PARENT_ID = '2'
const INNER_EXECUTION_ID = '2:1'

test.describe('Vue Node Error', { tag: '@vue-nodes' }, () => {
  test('should display error state when node is missing (node from workflow is not installed)', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('missing/missing_nodes')

    await expect(
      comfyPage.vueNodes.getNodeInnerWrapper(UNKNOWN_NODE_ID)
    ).toHaveClass(ERROR_CLASS)
  })

  test('should display error state when node causes execution error', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('nodes/execution_error')
    await comfyPage.runButton.click()

    await expect(
      comfyPage.vueNodes.getNodeInnerWrapper(RAISE_ERROR_NODE_ID)
    ).toHaveClass(ERROR_CLASS)
  })

  test.describe('validation errors', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await enableErrorsOverlay(comfyPage)
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    })

    test('shows error ring when a validation error is returned for a node', async ({
      comfyPage
    }) => {
      const exec = new ExecutionHelper(comfyPage)
      await exec.mockValidationFailure({
        [KSAMPLER_NODE_ID]: buildKSamplerError(
          'value_bigger_than_max',
          'steps',
          'steps: 99999 is bigger than max 10000'
        )
      })

      await comfyPage.runButton.click()

      await expect(
        comfyPage.vueNodes.getNodeInnerWrapper(KSAMPLER_NODE_ID)
      ).toHaveClass(ERROR_CLASS)
    })

    test('clears error ring when user edits an out-of-range number widget back into range', async ({
      comfyPage
    }) => {
      const innerWrapper =
        comfyPage.vueNodes.getNodeInnerWrapper(KSAMPLER_NODE_ID)
      const exec = new ExecutionHelper(comfyPage)

      await test.step('queue with out-of-range steps to surface the error', async () => {
        await exec.mockValidationFailure({
          [KSAMPLER_NODE_ID]: buildKSamplerError(
            'value_bigger_than_max',
            'steps',
            'steps: 99999 is bigger than max 10000'
          )
        })
        await comfyPage.runButton.click()
        await dismissErrorOverlay(comfyPage)
        await expect(innerWrapper).toHaveClass(ERROR_CLASS)
      })

      await test.step('edit steps widget so the new value is within range', async () => {
        const stepsWidget = comfyPage.vueNodes.getWidgetByName(
          'KSampler',
          'steps'
        )
        const controls = comfyPage.vueNodes.getInputNumberControls(stepsWidget)
        // ScrubableNumberInput commits on blur — explicit blur avoids a race
        // with the keyup-Enter handler in case Enter is consumed elsewhere.
        await controls.input.fill('25')
        await controls.input.blur()
      })

      await expect(innerWrapper).not.toHaveClass(ERROR_CLASS)
    })

    test('clears error ring when user picks a different combo option', async ({
      comfyPage
    }) => {
      const innerWrapper =
        comfyPage.vueNodes.getNodeInnerWrapper(KSAMPLER_NODE_ID)
      const exec = new ExecutionHelper(comfyPage)

      await test.step('queue with invalid sampler to surface the error', async () => {
        await exec.mockValidationFailure({
          [KSAMPLER_NODE_ID]: buildKSamplerError(
            'value_not_in_list',
            'sampler_name',
            'sampler_name: bogus_sampler is not in list'
          )
        })
        await comfyPage.runButton.click()
        await dismissErrorOverlay(comfyPage)
        await expect(innerWrapper).toHaveClass(ERROR_CLASS)
      })

      await test.step('select a different sampler option', async () => {
        await comfyPage.vueNodes.selectComboOption(
          'KSampler',
          'sampler_name',
          'dpmpp_2m'
        )
      })

      await expect(innerWrapper).not.toHaveClass(ERROR_CLASS)
    })
  })

  test.describe('subgraph propagation', { tag: '@subgraph' }, () => {
    test.beforeEach(async ({ comfyPage }) => {
      await enableErrorsOverlay(comfyPage)
      await cleanupFakeModel(comfyPage)
    })

    test('parent subgraph node shows error ring when an interior node is missing', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('missing/missing_nodes_in_subgraph')

      await expect(
        comfyPage.vueNodes.getNodeInnerWrapper(SUBGRAPH_PARENT_ID)
      ).toHaveClass(ERROR_CLASS)
    })

    test('parent subgraph node shows error ring when an interior node has a missing model', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'missing/missing_models_in_subgraph'
      )

      await expect(
        comfyPage.vueNodes.getNodeInnerWrapper(SUBGRAPH_PARENT_ID)
      ).toHaveClass(ERROR_CLASS)
    })

    test('parent subgraph node shows error ring when an interior node fails execution', async ({
      comfyPage,
      getWebSocket
    }) => {
      const innerWrapper =
        comfyPage.vueNodes.getNodeInnerWrapper(SUBGRAPH_PARENT_ID)
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await expect(
        innerWrapper,
        'subgraph parent must mount before injecting WS execution_error'
      ).toBeVisible()
      await expect(innerWrapper).not.toHaveClass(ERROR_CLASS)

      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)
      exec.executionError(
        'mocked-prompt',
        INNER_EXECUTION_ID,
        'boom inside the subgraph'
      )

      await expect(innerWrapper).toHaveClass(ERROR_CLASS)
    })

    test('parent subgraph node shows error ring when interior node has a validation error', async ({
      comfyPage
    }) => {
      // Validation errors are keyed by execution id, so an interior error
      // ("2:1") must propagate the ring up to the root-level subgraph
      // container ("2") via errorAncestorExecutionIds.
      const innerWrapper =
        comfyPage.vueNodes.getNodeInnerWrapper(SUBGRAPH_PARENT_ID)
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await expect(innerWrapper).toBeVisible()
      await expect(innerWrapper).not.toHaveClass(ERROR_CLASS)

      const exec = new ExecutionHelper(comfyPage)
      await exec.mockValidationFailure({
        [INNER_EXECUTION_ID]: buildKSamplerError(
          'value_bigger_than_max',
          'steps',
          'steps: 99999 is bigger than max 10000'
        )
      })
      await comfyPage.runButton.click()

      await expect(innerWrapper).toHaveClass(ERROR_CLASS)
    })
  })
})
