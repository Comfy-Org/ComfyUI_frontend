import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { toNodeId } from '@/types/nodeId'
import {
  cleanupFakeModel,
  dismissErrorOverlay,
  enableErrorsOverlay
} from '@e2e/fixtures/helpers/ErrorsTabHelper'
import {
  ExecutionHelper,
  buildKSamplerError
} from '@e2e/fixtures/helpers/ExecutionHelper'
import type { NodeError } from '@/schemas/apiSchema'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const ERROR_CLASS = /ring-destructive-background/
const SLOT_ERROR_CLASS = /before:ring-error/
const UNKNOWN_NODE_ID = '1'
const INNER_EXECUTION_ID = '2:1'
const KSAMPLER_MODEL_INPUT_NAME = 'model'
const LOAD_IMAGE_INPUT_NAME = 'image'
const LOAD_IMAGE_UPLOAD_FILE = 'test_upload_image.png'

function buildLoadImageRequiredInputError(): NodeError {
  return {
    class_type: 'LoadImage',
    dependent_outputs: [],
    errors: [
      {
        type: 'required_input_missing',
        message: `Required input is missing: ${LOAD_IMAGE_INPUT_NAME}`,
        details: '',
        extra_info: { input_name: LOAD_IMAGE_INPUT_NAME }
      }
    ]
  }
}

async function surfaceLoadImageMissingInputError(
  comfyPage: ComfyPage,
  loadImageId: string
): Promise<void> {
  const exec = new ExecutionHelper(comfyPage)
  await exec.mockValidationFailure({
    [loadImageId]: buildLoadImageRequiredInputError()
  })
  await comfyPage.runButton.click()
  await dismissErrorOverlay(comfyPage)
}

async function selectLoadImageNodeForPaste(
  comfyPage: ComfyPage,
  loadImageId: string
): Promise<void> {
  const localLoadImageId = toNodeId(loadImageId)
  await comfyPage.page.evaluate((nodeId) => {
    const node = window.app!.graph.getNodeById(nodeId)
    if (!node) throw new Error(`Load Image node ${nodeId} not found`)
    window.app!.canvas.selectNode(node)
    window.app!.canvas.current_node = node
  }, localLoadImageId)
}

async function getInputSlotIndexByName(
  comfyPage: ComfyPage,
  nodeId: string,
  inputName: string
): Promise<number> {
  return comfyPage.page.evaluate(
    ({ inputName, nodeId }) => {
      const graph = window.app!.canvas.graph ?? window.app!.graph
      const node = graph.getNodeById(nodeId)
      const index = node?.findInputSlot(inputName) ?? -1
      if (index < 0) {
        throw new Error(`Input slot "${inputName}" not found`)
      }
      return index
    },
    { inputName, nodeId: toNodeId(nodeId) }
  )
}

async function setupLoadImageErrorScenario(comfyPage: ComfyPage) {
  await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
  const loadImageNode = (
    await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
  )[0]
  const loadImageId = String(loadImageNode.id)

  return {
    loadImageId,
    innerWrapper: comfyPage.vueNodes.getNodeInnerWrapper(loadImageId),
    imageWidget: await loadImageNode.getWidgetByName(LOAD_IMAGE_INPUT_NAME)
  }
}

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
    const raiseErrorId =
      await comfyPage.vueNodes.getNodeIdByTitle('Raise Error')
    await comfyPage.runButton.click()

    await expect(
      comfyPage.vueNodes.getNodeInnerWrapper(raiseErrorId)
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
      const ksamplerId = await comfyPage.vueNodes.getNodeIdByTitle('KSampler')
      const exec = new ExecutionHelper(comfyPage)
      await exec.mockValidationFailure({
        [ksamplerId]: buildKSamplerError(
          'value_bigger_than_max',
          'steps',
          'steps: 99999 is bigger than max 10000'
        )
      })

      await comfyPage.runButton.click()

      await expect(
        comfyPage.vueNodes.getNodeInnerWrapper(ksamplerId)
      ).toHaveClass(ERROR_CLASS)
    })

    test(
      'highlights the missing required input slot',
      { tag: ['@screenshot', '@node'] },
      async ({ comfyPage }) => {
        const ksamplerId = await comfyPage.vueNodes.getNodeIdByTitle('KSampler')
        const ksamplerNode = comfyPage.vueNodes.getNodeLocator(ksamplerId)
        const modelInputIndex = await getInputSlotIndexByName(
          comfyPage,
          ksamplerId,
          KSAMPLER_MODEL_INPUT_NAME
        )
        const modelInputSlotRow = comfyPage.vueNodes.getInputSlotRow(
          ksamplerId,
          modelInputIndex
        )
        const modelInputSlotHighlight =
          comfyPage.vueNodes.getInputSlotConnectionDot(
            ksamplerId,
            modelInputIndex
          )
        const exec = new ExecutionHelper(comfyPage)
        await exec.mockValidationFailure({
          [ksamplerId]: buildKSamplerError(
            'required_input_missing',
            KSAMPLER_MODEL_INPUT_NAME,
            `Required input is missing: ${KSAMPLER_MODEL_INPUT_NAME}`
          )
        })

        await comfyPage.runButton.click()
        await dismissErrorOverlay(comfyPage)
        await fitToViewInstant(comfyPage)

        await expect(modelInputSlotRow).toBeVisible()
        await expect(modelInputSlotRow).toBeInViewport()
        await expect(modelInputSlotHighlight).toHaveClass(SLOT_ERROR_CLASS)
        await expect(
          comfyPage.vueNodes.getNodeInnerWrapper(ksamplerId)
        ).toHaveClass(ERROR_CLASS)
        await comfyPage.expectScreenshot(
          ksamplerNode,
          'vue-node-required-input-missing-slot-error.png'
        )
      }
    )

    test('clears error ring when user edits an out-of-range number widget back into range', async ({
      comfyPage
    }) => {
      const ksamplerId = await comfyPage.vueNodes.getNodeIdByTitle('KSampler')
      const innerWrapper = comfyPage.vueNodes.getNodeInnerWrapper(ksamplerId)
      const exec = new ExecutionHelper(comfyPage)

      await test.step('queue with out-of-range steps to surface the error', async () => {
        await exec.mockValidationFailure({
          [ksamplerId]: buildKSamplerError(
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
      const ksamplerId = await comfyPage.vueNodes.getNodeIdByTitle('KSampler')
      const innerWrapper = comfyPage.vueNodes.getNodeInnerWrapper(ksamplerId)
      const exec = new ExecutionHelper(comfyPage)

      await test.step('queue with invalid sampler to surface the error', async () => {
        await exec.mockValidationFailure({
          [ksamplerId]: buildKSamplerError(
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

    test('clears error ring when user drops an image file onto Load Image', async ({
      comfyPage
    }) => {
      const { loadImageId, innerWrapper, imageWidget } =
        await setupLoadImageErrorScenario(comfyPage)

      await test.step('queue with missing image input to surface the error', async () => {
        await surfaceLoadImageMissingInputError(comfyPage, loadImageId)
        await expect(innerWrapper).toHaveClass(ERROR_CLASS)
      })

      await test.step('drop an image onto the Load Image node', async () => {
        const dropPosition =
          await comfyPage.canvasOps.getNodeCenterByTitle('Load Image')
        if (!dropPosition) {
          throw new Error('Load Image node center must be available for drop')
        }

        await comfyPage.dragDrop.dragAndDropFile(LOAD_IMAGE_UPLOAD_FILE, {
          dropPosition,
          waitForUpload: true
        })
        await expect
          .poll(() => imageWidget.getValue())
          .toContain(LOAD_IMAGE_UPLOAD_FILE)
      })

      await expect(innerWrapper).not.toHaveClass(ERROR_CLASS)
    })

    test('clears error ring when user pastes an image file onto Load Image', async ({
      comfyPage
    }) => {
      const { loadImageId, innerWrapper, imageWidget } =
        await setupLoadImageErrorScenario(comfyPage)

      await test.step('queue with missing image input to surface the error', async () => {
        await surfaceLoadImageMissingInputError(comfyPage, loadImageId)
        await expect(innerWrapper).toHaveClass(ERROR_CLASS)
      })

      await test.step('paste an image while Load Image is selected', async () => {
        await comfyPage.canvas.focus()
        await selectLoadImageNodeForPaste(comfyPage, loadImageId)
        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => window.app!.canvas.current_node?.type)
          )
          .toBe('LoadImage')

        const uploadResponse = comfyPage.page.waitForResponse(
          (resp) => resp.url().includes('/upload/') && resp.status() === 200,
          { timeout: 10_000 }
        )
        // File clipboard contents cannot be seeded reliably in Playwright;
        // use the direct document paste mode to exercise usePaste.
        await comfyPage.clipboard.pasteFile(assetPath(LOAD_IMAGE_UPLOAD_FILE), {
          mode: 'direct'
        })
        await uploadResponse
        await expect
          .poll(() => imageWidget.getValue())
          .toContain(LOAD_IMAGE_UPLOAD_FILE)
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
      const subgraphParentId = await comfyPage.vueNodes.getNodeIdByTitle(
        'Subgraph with Missing Node'
      )

      await expect(
        comfyPage.vueNodes.getNodeInnerWrapper(subgraphParentId)
      ).toHaveClass(ERROR_CLASS)
    })

    test('parent subgraph node shows error ring when an interior node has a missing model', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'missing/missing_models_in_subgraph'
      )
      const subgraphParentId = await comfyPage.vueNodes.getNodeIdByTitle(
        'Subgraph with Missing Model'
      )

      await expect(
        comfyPage.vueNodes.getNodeInnerWrapper(subgraphParentId)
      ).toHaveClass(ERROR_CLASS)
    })

    test('parent subgraph node shows error ring when an interior node fails execution', async ({
      comfyPage,
      getWebSocket
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      const subgraphParentId =
        await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
      const innerWrapper =
        comfyPage.vueNodes.getNodeInnerWrapper(subgraphParentId)
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
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      const subgraphParentId =
        await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
      const innerWrapper =
        comfyPage.vueNodes.getNodeInnerWrapper(subgraphParentId)
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

    test('boundary-linked validation error surfaces on the subgraph host', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      const subgraphParentId =
        await comfyPage.vueNodes.getNodeIdByTitle('New Subgraph')
      const innerWrapper =
        comfyPage.vueNodes.getNodeInnerWrapper(subgraphParentId)
      const hostInputIndex = await getInputSlotIndexByName(
        comfyPage,
        subgraphParentId,
        'positive'
      )
      const hostInputSlotHighlight =
        comfyPage.vueNodes.getInputSlotConnectionDot(
          subgraphParentId,
          hostInputIndex
        )
      await expect(
        innerWrapper,
        'subgraph host must mount before injecting validation errors'
      ).toBeVisible()
      await expect(
        innerWrapper,
        'subgraph host should start without an error ring'
      ).not.toHaveClass(ERROR_CLASS)

      await test.step('surface the boundary-linked error on the host', async () => {
        const exec = new ExecutionHelper(comfyPage)
        await exec.mockValidationFailure({
          [INNER_EXECUTION_ID]: buildKSamplerError(
            'required_input_missing',
            'positive',
            'Required input is missing: positive'
          )
        })
        await comfyPage.runButton.click()
        await dismissErrorOverlay(comfyPage)

        await expect(innerWrapper).toHaveClass(ERROR_CLASS)
        await expect(hostInputSlotHighlight).toHaveClass(SLOT_ERROR_CLASS)
      })

      await test.step('confirm the interior node does not show the surfaced ring', async () => {
        await comfyPage.vueNodes.enterSubgraph(subgraphParentId)
        await comfyPage.nextFrame()
        await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)
        const interiorKSamplerId =
          await comfyPage.vueNodes.getNodeIdByTitle('KSampler')
        const interiorPositiveInputIndex = await getInputSlotIndexByName(
          comfyPage,
          interiorKSamplerId,
          'positive'
        )
        const interiorPositiveSlotHighlight =
          comfyPage.vueNodes.getInputSlotConnectionDot(
            interiorKSamplerId,
            interiorPositiveInputIndex
          )
        const interiorInnerWrapper =
          comfyPage.vueNodes.getNodeInnerWrapper(interiorKSamplerId)

        await expect(interiorInnerWrapper).toBeVisible()
        await expect(interiorInnerWrapper).not.toHaveClass(ERROR_CLASS)
        await expect(interiorPositiveSlotHighlight).toBeVisible()
        await expect(interiorPositiveSlotHighlight).not.toHaveClass(
          SLOT_ERROR_CLASS
        )
      })
    })
  })
})
