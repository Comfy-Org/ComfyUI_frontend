import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { assetPath } from '@e2e/fixtures/utils/paths'
import {
  PREVIEW3D_CAMERA_AXIS_RESTORE_EPS,
  PREVIEW3D_CAMERA_ZOOM_RESTORE_EPS,
  preview3dCameraStatesDiffer as cameraStatesDiffer,
  preview3dRestoreCameraStatesMatch
} from '@e2e/fixtures/utils/preview3dCameraState'
import { Load3DHelper } from '@e2e/tests/load3d/Load3DHelper'

async function orbitDragFromCanvasCenter(
  page: Page,
  canvas: Locator,
  delta: { dx: number; dy: number },
  steps: number
): Promise<void> {
  await canvas.scrollIntoViewIfNeeded()
  await expect
    .poll(
      async () => {
        const b = await canvas.boundingBox()
        return b !== null && b.width > 0 && b.height > 0
      },
      {
        timeout: 15_000,
        message:
          '3D canvas should have non-zero bounding box before orbit drag (layout / WebGL surface ready)'
      }
    )
    .toBe(true)

  const box = await canvas.boundingBox()
  expect(box, 'canvas bounding box should exist').not.toBeNull()
  const cx = box!.x + box!.width / 2
  const cy = box!.y + box!.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + delta.dx, cy + delta.dy, { steps })
  await page.mouse.up()
}

export class Preview3DPipelineContext {
  /** Matches node ids in `browser_tests/assets/3d/preview3d_pipeline.json`. */
  static readonly loadNodeId = '1'
  /** Matches node ids in `browser_tests/assets/3d/preview3d_pipeline.json`. */
  static readonly previewNodeId = '2'

  readonly load3d: Load3DHelper
  readonly preview3d: Load3DHelper

  constructor(readonly comfyPage: ComfyPage) {
    this.load3d = new Load3DHelper(
      comfyPage.vueNodes.getNodeLocator(Preview3DPipelineContext.loadNodeId)
    )
    this.preview3d = new Load3DHelper(
      comfyPage.vueNodes.getNodeLocator(Preview3DPipelineContext.previewNodeId)
    )
  }

  async getModelFileWidgetValue(nodeId: string): Promise<string> {
    return this.comfyPage.page.evaluate((id) => {
      const node = window.app!.graph.getNodeById(Number(id))
      if (!node?.widgets) return ''
      const w = node.widgets.find((x) => x.name === 'model_file')
      const v = w?.value
      return typeof v === 'string' ? v : ''
    }, nodeId)
  }

  async getLastTimeModelFile(nodeId: string): Promise<string> {
    return this.comfyPage.page.evaluate((id) => {
      const node = window.app!.graph.getNodeById(Number(id))
      if (!node?.properties) return ''
      const v = (node.properties as Record<string, unknown>)[
        'Last Time Model File'
      ]
      return typeof v === 'string' ? v : ''
    }, nodeId)
  }

  async getCameraStateFromProperties(nodeId: string): Promise<unknown> {
    return this.comfyPage.page.evaluate((id) => {
      const node = window.app!.graph.getNodeById(Number(id))
      if (!node?.properties) return null
      const cfg = (node.properties as Record<string, unknown>)['Camera Config']
      if (cfg === null || typeof cfg !== 'object') return null
      if (!('state' in cfg)) return null
      const rec = cfg as Record<string, unknown>
      return rec.state ?? null
    }, nodeId)
  }

  async seedLoad3dWithCubeObj(): Promise<void> {
    const fileChooserPromise = this.comfyPage.page.waitForEvent('filechooser')
    await this.load3d.getUploadButton('upload 3d model').click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(assetPath('cube.obj'))

    await expect
      .poll(() =>
        this.getModelFileWidgetValue(Preview3DPipelineContext.loadNodeId)
      )
      .toContain('cube.obj')

    await this.load3d.waitForModelLoaded()
    await this.comfyPage.nextFrame()
  }

  async setNonDefaultLoad3dCameraState(): Promise<void> {
    const initialCamera = await this.getCameraStateFromProperties(
      Preview3DPipelineContext.loadNodeId
    )
    await orbitDragFromCanvasCenter(
      this.comfyPage.page,
      this.load3d.canvas,
      { dx: 80, dy: 20 },
      10
    )
    await this.comfyPage.nextFrame()

    await expect
      .poll(
        async () => {
          const current = await this.getCameraStateFromProperties(
            Preview3DPipelineContext.loadNodeId
          )
          if (current === null) return false
          if (initialCamera === null) return true
          return cameraStatesDiffer(current, initialCamera, 1e-4)
        },
        {
          timeout: 10_000,
          message:
            'Load3D camera state should change after orbit drag (see cameraStatesDiffer)'
        }
      )
      .toBe(true)
  }

  async nudgePreview3dCameraIntoProperties(): Promise<void> {
    await orbitDragFromCanvasCenter(
      this.comfyPage.page,
      this.preview3d.canvas,
      { dx: -60, dy: 20 },
      10
    )
    await this.comfyPage.nextFrame()
  }

  async alignPreview3dWorkflowUiSettings(): Promise<void> {
    await this.comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await this.comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Sidebar'
    )
  }

  async queuePromptAndWaitIdle(timeoutMs: number): Promise<void> {
    await this.comfyPage.command.executeCommand('Comfy.QueuePrompt')
    await this.comfyPage.workflow.waitForWorkflowIdle(timeoutMs)
  }

  async assertPreview3dExecutionOutputSettled(): Promise<void> {
    const previewId = Preview3DPipelineContext.previewNodeId
    await expect
      .poll(() => this.getModelFileWidgetValue(previewId))
      .not.toBe('')
    const modelPath = await this.getModelFileWidgetValue(previewId)
    expect(modelPath.length, 'Preview3D model path populated').toBeGreaterThan(
      4
    )
    await expect
      .poll(() => this.getLastTimeModelFile(previewId))
      .toBe(modelPath)
    await this.preview3d.waitForModelLoaded()
  }

  async assertPreview3dCanvasNonEmpty(): Promise<void> {
    await expect
      .poll(async () => {
        const b = await this.preview3d.canvas.boundingBox()
        return (b?.width ?? 0) > 0 && (b?.height ?? 0) > 0
      })
      .toBe(true)
  }

  async getPreview3dCameraStateWhenReady(): Promise<unknown> {
    let last: unknown = null
    await expect
      .poll(
        async () => {
          last = await this.getCameraStateFromProperties(
            Preview3DPipelineContext.previewNodeId
          )
          return last !== null
        },
        {
          message:
            'Preview3D Camera Config.state should exist after orbit (cameraChanged)'
        }
      )
      .toBe(true)
    return last
  }

  async saveNamedWorkflowToSidebar(prefix: string): Promise<string> {
    const workflowName = `${prefix}-${Date.now().toString(36)}`
    await this.comfyPage.menu.workflowsTab.open()
    await this.comfyPage.menu.topbar.saveWorkflow(workflowName)
    return workflowName
  }

  async reloadPageAndWaitForAppShell(): Promise<void> {
    await this.comfyPage.page.reload({ waitUntil: 'domcontentloaded' })
    await this.comfyPage.page.waitForFunction(
      () => window.app && window.app.extensionManager,
      { timeout: 30_000 }
    )
    await this.comfyPage.page.locator('.p-blockui-mask').waitFor({
      state: 'hidden',
      timeout: 30_000
    })
    await this.comfyPage.nextFrame()
  }

  async openPersistedWorkflowFromSidebar(workflowName: string): Promise<void> {
    await this.alignPreview3dWorkflowUiSettings()
    const tab = this.comfyPage.menu.workflowsTab
    await tab.open()
    await tab.getPersistedItem(workflowName).click()
    await this.comfyPage.workflow.waitForWorkflowIdle(30_000)
    await this.comfyPage.vueNodes.waitForNodes()
  }

  async assertPreview3dModelPathAndLastTime(path: string): Promise<void> {
    const previewId = Preview3DPipelineContext.previewNodeId
    await expect.poll(() => this.getModelFileWidgetValue(previewId)).toBe(path)
    await expect.poll(() => this.getLastTimeModelFile(previewId)).toBe(path)
    await this.preview3d.waitForModelLoaded()
  }

  async assertPreview3dCameraRestored(savedCamera: unknown): Promise<void> {
    await expect
      .poll(
        async () =>
          preview3dRestoreCameraStatesMatch(
            await this.getCameraStateFromProperties(
              Preview3DPipelineContext.previewNodeId
            ),
            savedCamera
          ),
        {
          timeout: 15_000,
          message: `Preview3D camera after reload should match saved state (axis max delta ≤ ${PREVIEW3D_CAMERA_AXIS_RESTORE_EPS}, zoom delta ≤ ${PREVIEW3D_CAMERA_ZOOM_RESTORE_EPS}; see browser_tests/fixtures/utils/preview3dCameraState.ts)`
        }
      )
      .toBe(true)
  }
}

export const preview3dPipelineTest = comfyPageFixture.extend<{
  preview3dPipeline: Preview3DPipelineContext
}>({
  preview3dPipeline: async ({ comfyPage }, use) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.WorkflowTabsPosition',
      'Sidebar'
    )

    await comfyPage.workflow.loadWorkflow('3d/preview3d_pipeline')
    await comfyPage.vueNodes.waitForNodes()

    const pipeline = new Preview3DPipelineContext(comfyPage)
    await use(pipeline)

    await comfyPage.workflow.setupWorkflowsDirectory({})
  }
})
