export interface ConnectivityExpectations {
  excludedNodeTypes: Record<
    string,
    { pack: string; reason: string; restore: string }
  >
  connectRejected: string[]
  conditionalSlotContractMismatch: string[]
  deterministicSlotContractMismatch: string[]
  roundtripLost: string[]
  zeroPairDragExpectedNodeCounts: Partial<Record<string, number>>
  noPairContributionExpectedNodeCounts: Partial<Record<string, number>>
}

export const connectivityExpectations: ConnectivityExpectations = {
  excludedNodeTypes: {},
  connectRejected: [
    'AddTextPrefix.texts -> MathExpression|pysssss.expression',
    'FL_NodeLoader.TRIGGER -> FL_NodeLoader.trigger',
    'FL_NodeLoader.TRIGGER -> FL_NodePackLoader.trigger',
    'FL_NodePackLoader.TRIGGER -> FL_NodeLoader.trigger'
  ],
  // TimerNodeKJ throws only when an earlier KJNodes creation race corrupts
  // shared editor state, so these pairs must stay planned but need not fire.
  conditionalSlotContractMismatch: [
    'TimerNodeKJ.timer -> TimerNodeKJ.timer',
    'TimerNodeKJ.time -> AddLabel.text_x'
  ],
  deterministicSlotContractMismatch: [
    // MultiImageLoader trims its 50 declared image outputs to the loaded count.
    ...Array.from(
      { length: 50 },
      (_, index) => `MultiImageLoader.image_${index + 1} -> AddLabel.image`
    ),
    // FL_VideoBatchSplitter exposes only the default 4 of 20 outputs.
    ...Array.from(
      { length: 16 },
      (_, index) =>
        `FL_VideoBatchSplitter.batch_${index + 5} -> ACN_AdvancedControlNetApply.image`
    ),
    // FL_TimeLine replaces node.serialize and loses graph identity on reload.
    'FL_TimeLine.MODEL -> ACN_AdvancedControlNetApply.model_optional'
  ],
  // VHS_SelectLatest rebuilds its dynamic slots during configure.
  roundtripLost: [
    // Vewd rebuilds its dynamic slots during configure, same mechanism as
    // VHS_SelectLatest below.
    'AddTextPrefix.texts -> Vewd.folder',
    'AddTextPrefix.texts -> Vewd.filename_prefix',
    'AddTextPrefix.texts -> Vewd.selected_media',
    'BatchCount+.INT -> Vewd.max_frames',
    'VHS_SelectLatest.Filename -> AddTextPrefix.texts',
    'AddTextPrefix.texts -> VHS_SelectLatest.filename_prefix',
    'AddTextPrefix.texts -> VHS_SelectLatest.filename_postfix',
    'VHS_SelectLatest.Filename -> AddLabel.font_color',
    'ACN_AdvancedControlNetApply.model_opt -> FL_TimeLine.model',
    'AddTextPrefix.texts -> FL_TimeLine.timeline_data',
    'AudioReactiveTransform.frame_count -> FL_TimeLine.video_width',
    'AudioReactiveTransform.frame_count -> FL_TimeLine.video_height',
    'AudioReactiveTransform.frame_count -> FL_TimeLine.number_animation_frames',
    'AudioReactiveTransform.frame_count -> FL_TimeLine.frames_per_second',
    'CompositorTools3.tools -> ACN_SparseCtrlLoaderAdvanced.use_motion'
  ],
  // Packs that contribute no pair at all, in-pack or cross-pack: their one
  // node's slot types have no counterpart anywhere in the corpus. The count is
  // the assertion, as above.
  noPairContributionExpectedNodeCounts: {
    'comfyui-impact-subpack': 1
  },
  // Packs too small to wire to themselves: the drag sweep needs a producer and
  // a consumer inside one pack, and these register one or two nodes. The count
  // is the assertion - a pack that grows past it has pairs to find and the
  // entry must go.
  zeroPairDragExpectedNodeCounts: {
    'comfyui-impact-subpack': 1,
    'comfyui-qwenmultiangle': 1,
    'comfyui-string-converter': 2,
    'comfyui-workflow-prettier': 1
  }
}
