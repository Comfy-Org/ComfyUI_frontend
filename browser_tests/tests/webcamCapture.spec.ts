import type {
  PromptResponse,
  UploadImageResponse
} from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'
import type { Locator, Page, Request } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

const NODE_TITLE = 'Webcam Capture'

function denyCameraAccess(page: Page): Promise<void> {
  return page.evaluate(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () =>
          Promise.reject(new Error('Permission denied by test'))
      }
    })
  })
}

function holdCameraAccess(page: Page): Promise<void> {
  return page.evaluate(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: () => new Promise(() => {}) }
    })
  })
}

function denyAccessInInsecureContext(page: Page): Promise<void> {
  return page.evaluate(() => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: false
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: () =>
          Promise.reject(new Error('Insecure context rejection'))
      }
    })
  })
}

async function parseMultipartRequest(request: Request): Promise<FormData> {
  const body = request.postDataBuffer()
  if (!body) throw new Error('request has no body')
  return new Response(new Uint8Array(body), {
    headers: { 'content-type': request.headers()['content-type'] ?? '' }
  }).formData()
}

/**
 * Stub /upload/image + /api/prompt so queueing succeeds without a backend.
 * Returns the mutable list of captured upload requests - callers poll its
 * length to wait for the upload to fire.
 */
async function interceptUpload(page: Page): Promise<Request[]> {
  const uploadRequests: Request[] = []
  const uploadResponse: UploadImageResponse = {
    name: 'captured.png',
    subfolder: 'webcam',
    type: 'temp'
  }
  const promptResponse: PromptResponse = {
    prompt_id: 'test',
    number: 1,
    node_errors: {}
  }
  await page.route('**/upload/image', (route) => {
    uploadRequests.push(route.request())
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(uploadResponse)
    })
  })
  await page.route('**/api/prompt', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(promptResponse)
    })
  )
  return uploadRequests
}

class WebcamCaptureFixture {
  public readonly node: Locator
  public readonly captureButton: Locator
  public readonly waitingButton: Locator
  public readonly errorMessage: Locator
  public readonly widthInput: Locator
  public readonly heightInput: Locator
  public readonly captureOnQueueToggle: Locator
  public readonly previewImage: Locator

  constructor(comfyPage: ComfyPage) {
    const { vueNodes } = comfyPage
    this.node = vueNodes.getNodeByTitle(NODE_TITLE)
    this.captureButton = this.node.getByRole('button', {
      name: 'capture',
      exact: true
    })
    this.waitingButton = this.node.getByRole('button', {
      name: 'waiting for camera...',
      exact: true
    })
    this.errorMessage = this.node.getByText('Unable to load webcam')
    this.widthInput = vueNodes.getInputNumberControls(
      vueNodes.getWidgetByName(NODE_TITLE, 'width')
    ).input
    this.heightInput = vueNodes.getInputNumberControls(
      vueNodes.getWidgetByName(NODE_TITLE, 'height')
    ).input
    this.captureOnQueueToggle = this.node.getByRole('switch', {
      name: 'capture_on_queue'
    })
    this.previewImage = this.node.locator('img[src^="data:image/png"]').first()
  }

  async waitForStreamReady(): Promise<void> {
    await expect(this.captureButton).toBeEnabled()
  }
}

test.use({
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream'
    ]
  }
})

test.describe(
  'Webcam Capture',
  { tag: ['@widget', '@canvas', '@vue-nodes'] },
  () => {
    test('enables the capture button once the stream is ready', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/webcam_capture')
      const webcam = new WebcamCaptureFixture(comfyPage)

      await expect(webcam.captureButton).toBeEnabled()
      await expect(webcam.waitingButton).toHaveCount(0)
      await expect(webcam.errorMessage).toHaveCount(0)
    })

    test('auto-populates width and height from the video stream', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/webcam_capture')
      const webcam = new WebcamCaptureFixture(comfyPage)

      // Workflow ships with width/height set to 0; the extension overwrites
      // them with the resolved track's intrinsic resolution once the stream
      // loads so users aren't left with a 0x0 capture surface.
      await webcam.waitForStreamReady()
      await expect(webcam.widthInput).not.toHaveValue('0')
      await expect(webcam.heightInput).not.toHaveValue('0')
    })

    test('shows the waiting state while the permission prompt is pending', async ({
      comfyPage
    }) => {
      await holdCameraAccess(comfyPage.page)
      await comfyPage.workflow.loadWorkflow('nodes/webcam_capture')
      const webcam = new WebcamCaptureFixture(comfyPage)

      await expect(webcam.waitingButton).toBeDisabled()
      await expect(webcam.captureButton).toHaveCount(0)
      await expect(webcam.errorMessage).toHaveCount(0)
    })

    test('surfaces the underlying rejection reason when denied', async ({
      comfyPage
    }) => {
      await denyCameraAccess(comfyPage.page)
      await comfyPage.workflow.loadWorkflow('nodes/webcam_capture')
      const webcam = new WebcamCaptureFixture(comfyPage)

      await expect(webcam.errorMessage).toBeVisible()
      await expect(
        webcam.errorMessage.filter({ hasText: 'Permission denied by test' })
      ).toBeVisible()
      await expect(webcam.waitingButton).toBeDisabled()
      await expect(webcam.captureButton).toHaveCount(0)
    })

    test('auto-captures and uploads a frame when queued with capture-on-queue', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/webcam_capture')
      const webcam = new WebcamCaptureFixture(comfyPage)
      await webcam.waitForStreamReady()
      await expect(
        webcam.captureOnQueueToggle,
        'workflow asset ships with capture_on_queue enabled'
      ).toBeChecked()

      const uploads = await interceptUpload(comfyPage.page)
      await comfyPage.runButton.click()

      await expect.poll(() => uploads.length).toBeGreaterThan(0)
      const form = await parseMultipartRequest(uploads[0])
      expect(form.get('subfolder')).toBe('webcam')
      expect(form.get('type')).toBe('temp')
      expect(form.get('image')).toBeInstanceOf(Blob)
    })

    test('renders a preview image inside the node after clicking capture', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/webcam_capture')
      const webcam = new WebcamCaptureFixture(comfyPage)
      await webcam.waitForStreamReady()

      await expect(webcam.previewImage).toHaveCount(0)
      await webcam.captureButton.click()
      await expect(webcam.previewImage).toBeVisible()
    })

    test('re-clicking capture replaces the preview with a fresh frame', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/webcam_capture')
      const webcam = new WebcamCaptureFixture(comfyPage)
      await webcam.waitForStreamReady()

      await webcam.captureButton.click()
      await expect(webcam.previewImage).toBeVisible()
      const firstSrc = await webcam.previewImage.getAttribute('src')

      // Chromium's fake device cycles frame content, so a second capture a
      // moment later must produce a different data URL.
      await expect
        .poll(async () => {
          await webcam.captureButton.click()
          return webcam.previewImage.getAttribute('src')
        })
        .not.toBe(firstSrc)
    })

    test('uploads the manually captured frame when queued with capture-on-queue off', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/webcam_capture')
      const webcam = new WebcamCaptureFixture(comfyPage)
      await webcam.waitForStreamReady()
      await webcam.captureOnQueueToggle.click()
      await expect(
        webcam.captureOnQueueToggle,
        'precondition: capture_on_queue toggled off'
      ).not.toBeChecked()

      await webcam.captureButton.click()
      await expect(webcam.previewImage).toBeVisible()

      const uploads = await interceptUpload(comfyPage.page)
      await comfyPage.runButton.click()
      await expect.poll(() => uploads.length).toBeGreaterThan(0)
    })

    test('explains the secure-context requirement on insecure origins', async ({
      comfyPage
    }) => {
      await denyAccessInInsecureContext(comfyPage.page)
      await comfyPage.workflow.loadWorkflow('nodes/webcam_capture')
      const webcam = new WebcamCaptureFixture(comfyPage)

      await expect(
        webcam.errorMessage.filter({ hasText: 'secure context is required' })
      ).toBeVisible()
      await expect(
        webcam.errorMessage.filter({ hasText: 'Insecure context rejection' })
      ).toBeVisible()
    })

    test('preserves user-set width and height across stream ready', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/webcam_capture_preset')
      const webcam = new WebcamCaptureFixture(comfyPage)
      await webcam.waitForStreamReady()

      await expect(webcam.widthInput).toHaveValue('123')
      await expect(webcam.heightInput).toHaveValue('456')
    })

    test('surfaces an error toast when the upload fails', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/webcam_capture')
      const webcam = new WebcamCaptureFixture(comfyPage)
      await webcam.waitForStreamReady()

      await comfyPage.page.route('**/upload/image', (route) =>
        route.fulfill({ status: 500, body: 'Server exploded' })
      )
      await comfyPage.runButton.click()

      await expect(
        comfyPage.toast.visibleToasts
          .filter({ hasText: 'Error uploading camera image' })
          .first()
      ).toBeVisible()
    })

    test('alerts the user when queued with no captured image', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/webcam_capture')
      const webcam = new WebcamCaptureFixture(comfyPage)
      await webcam.waitForStreamReady()
      await webcam.captureOnQueueToggle.click()
      await expect(
        webcam.captureOnQueueToggle,
        'precondition: capture_on_queue toggled off'
      ).not.toBeChecked()

      let uploadCalled = false
      await comfyPage.page.route('**/upload/image', (route) => {
        uploadCalled = true
        return route.fulfill({ status: 200, body: '{}' })
      })

      await comfyPage.runButton.click()

      await expect(
        comfyPage.toast.visibleToasts
          .filter({ hasText: 'No webcam image captured' })
          .first()
      ).toBeVisible()
      expect(uploadCalled).toBe(false)
    })
  }
)
