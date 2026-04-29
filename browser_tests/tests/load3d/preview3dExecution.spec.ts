import { expect } from '@playwright/test'

import {
  preview3dPipelineTest as test,
  Preview3DPipelineContext
} from '@e2e/fixtures/helpers/Preview3DPipelineFixture'

test.describe('Preview3D execution flow', { tag: ['@slow', '@node'] }, () => {
  test('Preview3D shows no error toast when execution output has no model file', async ({
    preview3dPipeline: pipeline
  }) => {
    // nextFrame ensures the nodeCreated nextTick has settled and onExecuted
    // is wired up before we call it.
    await pipeline.comfyPage.nextFrame()

    // Simulate onExecuted with an empty result — the scenario that previously
    // produced a spurious warning toast when filePath was missing.
    await pipeline.comfyPage.page.evaluate((previewId) => {
      const node = window.app!.graph.getNodeById(Number(previewId))
      node?.onExecuted?.({ result: [] })
    }, Preview3DPipelineContext.previewNodeId)

    await pipeline.comfyPage.nextFrame()
    await expect(
      pipeline.comfyPage.page.locator('.p-toast-message')
    ).toHaveCount(0)
  })

  test('Preview3D shows no error toast when model file cannot be loaded', async ({
    preview3dPipeline: pipeline
  }) => {
    await pipeline.comfyPage.nextFrame()

    // Simulate an execution result pointing to a file that does not exist on
    // the server. The LoaderManager should swallow the load error silently for
    // preview nodes (suppressErrors = true).
    const responsePromise = pipeline.comfyPage.page.waitForResponse((r) =>
      r.url().includes('nonexistent_preview_model.glb')
    )

    await pipeline.comfyPage.page.evaluate((previewId) => {
      const node = window.app!.graph.getNodeById(Number(previewId))
      node?.onExecuted?.({ result: ['nonexistent_preview_model.glb'] })
    }, Preview3DPipelineContext.previewNodeId)

    await responsePromise
    await pipeline.comfyPage.nextFrame()
    await expect(
      pipeline.comfyPage.page.locator('.p-toast-message')
    ).toHaveCount(0)
  })

  test('Preview3D loads model from execution output', async ({
    preview3dPipeline: pipeline
  }) => {
    test.setTimeout(120_000)

    await pipeline.seedLoad3dWithCubeObj()
    await pipeline.queuePromptAndWaitIdle(90_000)
    await pipeline.assertPreview3dExecutionOutputSettled()
    await pipeline.assertPreview3dCanvasNonEmpty()
  })

  test('Preview3D restores last model and camera after save and full reload', async ({
    preview3dPipeline: pipeline
  }) => {
    test.setTimeout(180_000)

    await pipeline.seedLoad3dWithCubeObj()
    await pipeline.setNonDefaultLoad3dCameraState()
    await pipeline.queuePromptAndWaitIdle(90_000)
    await pipeline.assertPreview3dExecutionOutputSettled()
    await pipeline.nudgePreview3dCameraIntoProperties()

    const savedPath = await pipeline.getModelFileWidgetValue(
      Preview3DPipelineContext.previewNodeId
    )
    const savedCamera = await pipeline.getPreview3dCameraStateWhenReady()
    const workflowName =
      await pipeline.saveNamedWorkflowToSidebar('p3d-restore')
    await pipeline.reloadPageAndWaitForAppShell()
    await pipeline.openPersistedWorkflowFromSidebar(workflowName)
    await pipeline.assertPreview3dModelPathAndLastTime(savedPath)
    await pipeline.assertPreview3dCanvasNonEmpty()
    await pipeline.assertPreview3dCameraRestored(savedCamera)
  })
})
