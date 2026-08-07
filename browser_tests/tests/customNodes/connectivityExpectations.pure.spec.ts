import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { connectivityExpectationsFor } from '@e2e/fixtures/customNode/connectivityExpectations'

test.describe('connectivityExpectationsFor', () => {
  test('limits zero-pair S5 relief to artifact-proven pack node counts', () => {
    expect(
      connectivityExpectationsFor('cloud').zeroPairDragExpectedNodeCounts
    ).toEqual({
      'comfyui-impact-subpack': 1,
      'comfyui-string-converter': 2,
      'comfyui-workflow-prettier': 1
    })
    expect(
      connectivityExpectationsFor('cloud').zeroPairDragExpectedNodeCounts
        .bfsnodes
    ).toBeUndefined()
    expect(
      connectivityExpectationsFor('core').zeroPairDragExpectedNodeCounts
    ).toEqual({})
  })

  test('keeps the legacy Core expectations scoped to Core', () => {
    const core = connectivityExpectationsFor('core')

    expect(core.connectRejected).toEqual([
      'AddTextPrefix.texts -> MathExpression|pysssss.expression'
    ])
    expect(core.conditionalSlotContractMismatch).toEqual([
      'TimerNodeKJ.timer -> TimerNodeKJ.timer',
      'TimerNodeKJ.time -> AddLabel.text_x'
    ])
    expect(core.deterministicSlotContractMismatch).toEqual([])
    expect(core.roundtripLost).toEqual([
      'AddTextPrefix.texts -> VHS_SelectLatest.filename_prefix',
      'AddTextPrefix.texts -> VHS_SelectLatest.filename_postfix',
      'VHS_SelectLatest.Filename -> AddLabel.font_color'
    ])
  })

  test('keeps the artifact-proven Cloud expectations scoped to Cloud', () => {
    const cloud = connectivityExpectationsFor('cloud')

    expect(cloud.connectRejected).toEqual([
      'FL_NodeLoader.TRIGGER -> FL_NodeLoader.trigger',
      'FL_NodeLoader.TRIGGER -> FL_NodePackLoader.trigger',
      'FL_NodePackLoader.TRIGGER -> FL_NodeLoader.trigger'
    ])
    expect(cloud.conditionalSlotContractMismatch).toEqual([])
    expect(cloud.deterministicSlotContractMismatch).toEqual([
      'PoseAndFaceDetection.face_bboxes -> SimpleCalculatorKJ.variables',
      ...Array.from(
        { length: 16 },
        (_, index) =>
          `FL_VideoBatchSplitter.batch_${index + 5} -> ◎ RadianceBlendComposite.base`
      )
    ])
    expect(cloud.roundtripLost).toEqual([
      'PoseAndFaceDetection.face_bboxes -> RTXVideoSuperResolution.resize_type',
      'PoseAndFaceDetection.face_bboxes -> ImageSharpenKJ.method',
      'PoseAndFaceDetection.face_bboxes -> SamplerSelfRefineVideo.input_mode',
      'PoseAndFaceDetection.face_bboxes -> LTXVAddGuideMulti.num_guides',
      'PoseAndFaceDetection.face_bboxes -> LTXVImgToVideoInplaceKJ.num_images',
      '◎ RadianceCinemaStudio.prompt -> VHS_SelectLatest.filename_prefix',
      '◎ RadianceCinemaStudio.prompt -> VHS_SelectLatest.filename_postfix',
      'VHS_SelectLatest.Filename -> ◎ RadianceCinemaStudio.base_prompt',
      'CompositorTools3.tools -> ◎ RadianceDenoise.hdr_auto_sigma',
      '◎ RadianceCinemaStudio.prompt -> Vewd.folder',
      '◎ RadianceCinemaStudio.prompt -> Vewd.filename_prefix',
      'AdaptiveLongestEdge_EditUtils.longest_edge -> Vewd.max_frames',
      '◎ RadianceCinemaStudio.prompt -> Vewd.selected_media'
    ])
    expect(cloud.connectRejected).not.toContain(
      'AddTextPrefix.texts -> MathExpression|pysssss.expression'
    )
  })

  test('covers only the missing dynamic outputs from 5 through 20', () => {
    const dynamic = connectivityExpectationsFor(
      'cloud'
    ).deterministicSlotContractMismatch.filter((key) =>
      key.startsWith('FL_VideoBatchSplitter.')
    )

    expect(dynamic).toHaveLength(16)
    expect(dynamic[0]).toContain('batch_5')
    expect(dynamic.at(-1)).toContain('batch_20')
  })
})
