export interface ConnectivityExpectations {
  connectRejected: string[]
  conditionalSlotContractMismatch: string[]
  deterministicSlotContractMismatch: string[]
  roundtripLost: string[]
  zeroPairDragExpectedNodeCounts: Partial<Record<string, number>>
  noPairContributionExpectedNodeCounts: Partial<Record<string, number>>
}

export const connectivityExpectations: ConnectivityExpectations = {
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
    // Vewd rebuilds its dynamic slots during configure, same mechanism as
    // VHS_SelectLatest below.
    'AddTextPrefix.texts -> Vewd.folder',
    'AddTextPrefix.texts -> Vewd.filename_prefix',
    'AddTextPrefix.texts -> Vewd.selected_media',
    'BatchCount+.INT -> Vewd.max_frames',
    'VHS_SelectLatest.Filename -> AddTextPrefix.texts',
    'AddTextPrefix.texts -> VHS_SelectLatest.filename_prefix',
    'AddTextPrefix.texts -> VHS_SelectLatest.filename_postfix',
    'VHS_SelectLatest.Filename -> AddLabel.font_color'
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
