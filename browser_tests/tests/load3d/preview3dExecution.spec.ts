import {
  preview3dPipelineTest as test,
  Preview3DPipelineContext
} from '@e2e/fixtures/helpers/Preview3DPipelineFixture'

test.describe('Preview3D execution flow', { tag: ['@slow', '@node'] }, () => {
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
