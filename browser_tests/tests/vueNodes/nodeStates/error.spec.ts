import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { assetPath } from '@e2e/fixtures/utils/paths'
import type { NodeError } from '@/schemas/apiSchema'

const ERROR_CLASS = /ring-destructive-background/
const LOAD_IMAGE_INPUT_NAME = 'image'
const LOAD_IMAGE_UPLOAD_FILE = 'test_upload_image.png'
const PROMPT_ROUTE_PATTERN = '**/api/prompt'

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
  await comfyPage.page.route(
    PROMPT_ROUTE_PATTERN,
    async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          node_errors: {
            [loadImageId]: buildLoadImageRequiredInputError()
          },
          error: {
            type: 'prompt_outputs_failed_validation',
            message: 'Prompt outputs failed validation',
            details: ''
          }
        })
      })
    },
    { times: 1 }
  )

  await comfyPage.runButton.click()
  const errorOverlay = comfyPage.page.getByTestId(TestIds.dialogs.errorOverlay)
  await expect(errorOverlay).toBeVisible()
  await errorOverlay.getByTestId(TestIds.dialogs.errorOverlayDismiss).click()
  await expect(errorOverlay).toBeHidden()
}

async function selectLoadImageNodeForPaste(
  comfyPage: ComfyPage,
  loadImageId: string
): Promise<void> {
  await comfyPage.page.evaluate((nodeId) => {
    const node = window.app!.graph.getNodeById(Number(nodeId))
    if (!node) throw new Error(`Load Image node ${nodeId} not found`)
    window.app!.canvas.selectNode(node)
    window.app!.canvas.current_node = node
  }, loadImageId)
}

async function setupLoadImageErrorScenario(comfyPage: ComfyPage) {
  await comfyPage.settings.setSetting(
    'Comfy.RightSidePanel.ShowErrorsTab',
    true
  )
  await comfyPage.setup()
  await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
  const loadImageNode = (
    await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
  )[0]
  const loadImageId = String(loadImageNode.id)

  return {
    loadImageId,
    innerWrapper: comfyPage.vueNodes
      .getNodeLocator(loadImageId)
      .getByTestId('node-inner-wrapper'),
    imageWidget: await loadImageNode.getWidget(0)
  }
}

test.describe('Vue Node Error', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.vueNodes.waitForNodes()
  })

  test('should display error state when node is missing (node from workflow is not installed)', async ({
    comfyPage
  }) => {
    await comfyPage.setup()
    await comfyPage.workflow.loadWorkflow('missing/missing_nodes')

    // Expect error state on missing unknown node
    const unknownNode = comfyPage.page
      .locator('[data-node-id]')
      .filter({ hasText: 'UNKNOWN NODE' })
      .getByTestId('node-inner-wrapper')
    await expect(unknownNode).toHaveClass(ERROR_CLASS)
  })

  test('should display error state when node causes execution error', async ({
    comfyPage
  }) => {
    await comfyPage.setup()
    await comfyPage.workflow.loadWorkflow('nodes/execution_error')
    await comfyPage.runButton.click()

    const raiseErrorNode = comfyPage.page
      .locator('[data-node-id]')
      .filter({ hasText: 'Raise Error' })
      .getByTestId('node-inner-wrapper')
    await expect(raiseErrorNode).toHaveClass(ERROR_CLASS)
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
