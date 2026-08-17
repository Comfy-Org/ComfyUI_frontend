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
  excludedNodeTypes: {
    FL_CodeNode: {
      pack: 'ComfyUI_Fill-Nodes',
      reason:
        'its frontend hook freezes the browser main thread during the graph round-trip',
      restore:
        'fix the FL_CodeNode frontend hook upstream, then remove this entry when the isolated sentinel completes'
    }
  },
  // MathExpression vetoes text-list producers for numeric expression inputs.
  connectRejected: ['AddTextPrefix.texts -> MathExpression|pysssss.expression'],
  // TimerNodeKJ throws only when an earlier KJNodes creation race corrupts
  // shared editor state, so these pairs must stay planned but need not fire.
  conditionalSlotContractMismatch: [
    'TimerNodeKJ.timer -> TimerNodeKJ.timer',
    'TimerNodeKJ.time -> AddLabel.text_x'
  ],
  // MultiImageLoader's def declares 51 outputs (RETURN_TYPES = ("IMAGE",) * 51:
  // multi_output plus image_1..image_50) and the pack's own JS trims them to
  // the loaded image count on creation, so every declared image_N past the live
  // ones is missing on the instance. Pack behaviour, not a frontend drop.
  deterministicSlotContractMismatch: Array.from(
    { length: 50 },
    (_, index) => `MultiImageLoader.image_${index + 1} -> AddLabel.image`
  ),
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
