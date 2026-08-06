export interface ConnectivityExpectations {
  connectRejected: string[]
  conditionalSlotContractMismatch: string[]
  deterministicSlotContractMismatch: string[]
  roundtripLost: string[]
  zeroPairDragExpectedNodeCounts: Partial<Record<string, number>>
}

const CORE_EXPECTATIONS: ConnectivityExpectations = {
  // MathExpression vetoes text-list producers for numeric expression inputs.
  connectRejected: ['AddTextPrefix.texts -> MathExpression|pysssss.expression'],
  // TimerNodeKJ throws only when an earlier KJNodes creation race corrupts
  // shared editor state, so these pairs must stay planned but need not fire.
  conditionalSlotContractMismatch: [
    'TimerNodeKJ.timer -> TimerNodeKJ.timer',
    'TimerNodeKJ.time -> AddLabel.text_x'
  ],
  deterministicSlotContractMismatch: [],
  // VHS_SelectLatest rebuilds its dynamic slots during configure.
  roundtripLost: [
    'AddTextPrefix.texts -> VHS_SelectLatest.filename_prefix',
    'AddTextPrefix.texts -> VHS_SelectLatest.filename_postfix',
    'VHS_SelectLatest.Filename -> AddLabel.font_color'
  ],
  zeroPairDragExpectedNodeCounts: {}
}

const CLOUD_EXPECTATIONS: ConnectivityExpectations = {
  // Fill declares uppercase TRIGGER outputs and lowercase trigger inputs.
  connectRejected: [
    'FL_NodeLoader.TRIGGER -> FL_NodeLoader.trigger',
    'FL_NodeLoader.TRIGGER -> FL_NodePackLoader.trigger',
    'FL_NodePackLoader.TRIGGER -> FL_NodeLoader.trigger'
  ],
  conditionalSlotContractMismatch: [],
  deterministicSlotContractMismatch: [
    // The malformed BBOX union plans a widget-only destination slot.
    'PoseAndFaceDetection.face_bboxes -> SimpleCalculatorKJ.variables',
    // Fill exposes only the selected four of twenty declared batch outputs.
    ...Array.from(
      { length: 16 },
      (_, index) =>
        `FL_VideoBatchSplitter.batch_${index + 5} -> ◎ RadianceBlendComposite.base`
    )
  ],
  roundtripLost: [
    // The malformed BBOX union plans five links that configure drops.
    'PoseAndFaceDetection.face_bboxes -> RTXVideoSuperResolution.resize_type',
    'PoseAndFaceDetection.face_bboxes -> ImageSharpenKJ.method',
    'PoseAndFaceDetection.face_bboxes -> SamplerSelfRefineVideo.input_mode',
    'PoseAndFaceDetection.face_bboxes -> LTXVAddGuideMulti.num_guides',
    'PoseAndFaceDetection.face_bboxes -> LTXVImgToVideoInplaceKJ.num_images',
    // VHS, CompositorTools3, and Vewd rebuild or omit pack-managed state.
    '◎ RadianceCinemaStudio.prompt -> VHS_SelectLatest.filename_prefix',
    '◎ RadianceCinemaStudio.prompt -> VHS_SelectLatest.filename_postfix',
    'VHS_SelectLatest.Filename -> ◎ RadianceCinemaStudio.base_prompt',
    'CompositorTools3.tools -> ◎ RadianceDenoise.hdr_auto_sigma',
    '◎ RadianceCinemaStudio.prompt -> Vewd.folder',
    '◎ RadianceCinemaStudio.prompt -> Vewd.filename_prefix',
    'AdaptiveLongestEdge_EditUtils.longest_edge -> Vewd.max_frames',
    '◎ RadianceCinemaStudio.prompt -> Vewd.selected_media'
  ],
  zeroPairDragExpectedNodeCounts: {
    'comfyui-impact-subpack': 1,
    'comfyui-string-converter': 2
  }
}

export function connectivityExpectationsFor(
  env: 'core' | 'cloud'
): ConnectivityExpectations {
  return env === 'cloud' ? CLOUD_EXPECTATIONS : CORE_EXPECTATIONS
}
