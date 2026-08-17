export interface ConnectivityExpectations {
  isolatedNodeTypes: Record<string, { pack: string; reason: string }>
  connectRejected: PairExpectationGroup[]
  deterministicSlotContractMismatch: PairExpectationGroup[]
  roundtripLost: PairExpectationGroup[]
  zeroPairDragExpectedNodeCounts: Partial<Record<string, number>>
  noPairContributionExpectedNodeCounts: Partial<Record<string, number>>
}

export interface PairExpectationGroup {
  id: string
  pack: string
  pairs: string[]
  reason: string
  restore: string
}

export function pairExpectationKeys(groups: PairExpectationGroup[]): string[] {
  return groups.flatMap((group) => group.pairs)
}

export const connectivityExpectations: ConnectivityExpectations = {
  isolatedNodeTypes: {
    FL_CodeNode: {
      pack: 'ComfyUI_Fill-Nodes',
      reason:
        'its deferred dynamic-slot cleanup is context-sensitive after repeated same-page graph resets'
    },
    TimerNodeKJ: {
      pack: 'ComfyUI-KJNodes',
      reason:
        'an earlier KJNodes creation race can corrupt shared editor state before this node mounts'
    }
  },
  connectRejected: [
    {
      id: 'math-expression-text-veto',
      pack: 'ComfyUI-Custom-Scripts',
      pairs: ['AddTextPrefix.texts -> MathExpression|pysssss.expression'],
      reason:
        'MathExpression rejects this materialized STRING connection despite matching object_info types',
      restore:
        'fix the MathExpression connection veto and remove this entry when the pair connects'
    },
    {
      id: 'fill-node-loader-trigger-veto',
      pack: 'ComfyUI_Fill-Nodes',
      pairs: [
        'FL_NodeLoader.TRIGGER -> FL_NodeLoader.trigger',
        'FL_NodeLoader.TRIGGER -> FL_NodePackLoader.trigger',
        'FL_NodePackLoader.TRIGGER -> FL_NodeLoader.trigger'
      ],
      reason:
        'the Fill loader nodes reject their own declared TRIGGER connections',
      restore:
        'fix the loader connection vetoes and remove this entry when all three pairs connect'
    }
  ],
  deterministicSlotContractMismatch: [
    {
      id: 'multi-image-loader-trimmed-outputs',
      pack: 'WhatDreamsCost-ComfyUI',
      pairs: Array.from(
        { length: 50 },
        (_, index) => `MultiImageLoader.image_${index + 1} -> AddLabel.image`
      ),
      reason:
        'MultiImageLoader trims its 50 declared image outputs to the loaded count',
      restore:
        'make object_info describe only materialized outputs and remove this entry'
    },
    {
      id: 'video-batch-splitter-trimmed-outputs',
      pack: 'ComfyUI_Fill-Nodes',
      pairs: Array.from(
        { length: 16 },
        (_, index) =>
          `FL_VideoBatchSplitter.batch_${index + 5} -> ACN_AdvancedControlNetApply.image`
      ),
      reason:
        'FL_VideoBatchSplitter exposes only the default 4 of 20 declared outputs',
      restore:
        'make object_info describe only materialized outputs and remove this entry'
    },
    {
      id: 'timeline-node-loss',
      pack: 'ComfyUI_Fill-Nodes',
      pairs: [
        'FL_TimeLine.MODEL -> ACN_AdvancedControlNetApply.model_optional'
      ],
      reason:
        'FL_TimeLine replaces node.serialize and loses graph identity on reload',
      restore:
        'preserve LiteGraph serialization and remove this entry when the pair survives reload'
    }
  ],
  roundtripLost: [
    {
      id: 'vewd-dynamic-input-reload',
      pack: 'vewd',
      pairs: [
        'AddTextPrefix.texts -> Vewd.folder',
        'AddTextPrefix.texts -> Vewd.filename_prefix',
        'AddTextPrefix.texts -> Vewd.selected_media',
        'BatchCount+.INT -> Vewd.max_frames'
      ],
      reason: 'Vewd rebuilds its dynamic inputs during configure',
      restore:
        'preserve these four links during configure and remove this entry'
    },
    {
      id: 'vhs-select-latest-dynamic-reload',
      pack: 'comfyui-videohelpersuite',
      pairs: [
        'VHS_SelectLatest.Filename -> AddTextPrefix.texts',
        'AddTextPrefix.texts -> VHS_SelectLatest.filename_prefix',
        'AddTextPrefix.texts -> VHS_SelectLatest.filename_postfix',
        'VHS_SelectLatest.Filename -> AddLabel.font_color'
      ],
      reason: 'VHS_SelectLatest rebuilds its dynamic slots during configure',
      restore:
        'preserve these four links during configure and remove this entry'
    },
    {
      id: 'fill-code-node-dynamic-reload',
      pack: 'ComfyUI_Fill-Nodes',
      pairs: [
        'AddTextPrefix.texts -> FL_CodeNode.code_input',
        'AddTextPrefix.texts -> FL_CodeNode.file',
        'BooleanBasic.BOOLEAN -> FL_CodeNode.use_file',
        'BooleanBasic.BOOLEAN -> FL_CodeNode.run_always'
      ],
      reason:
        'FL_CodeNode treats its four declared dynamic inputs as removable during configure',
      restore:
        'preserve these four links during configure and remove this entry'
    },
    {
      id: 'fill-timeline-dynamic-reload',
      pack: 'ComfyUI_Fill-Nodes',
      pairs: [
        'ACN_AdvancedControlNetApply.model_opt -> FL_TimeLine.model',
        'AddTextPrefix.texts -> FL_TimeLine.timeline_data',
        'AudioReactiveTransform.frame_count -> FL_TimeLine.video_width',
        'AudioReactiveTransform.frame_count -> FL_TimeLine.video_height',
        'AudioReactiveTransform.frame_count -> FL_TimeLine.number_animation_frames',
        'AudioReactiveTransform.frame_count -> FL_TimeLine.frames_per_second'
      ],
      reason:
        'FL_TimeLine replaces node.serialize and drops its declared inputs during configure',
      restore: 'preserve these six links during configure and remove this entry'
    },
    {
      id: 'advanced-controlnet-motion-link-reload',
      pack: 'comfyui-advanced-controlnet',
      pairs: [
        'CompositorTools3.tools -> ACN_SparseCtrlLoaderAdvanced.use_motion'
      ],
      reason:
        'ACN_SparseCtrlLoaderAdvanced drops its optional motion link during configure',
      restore:
        'preserve the use_motion link during configure and remove this entry'
    }
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
