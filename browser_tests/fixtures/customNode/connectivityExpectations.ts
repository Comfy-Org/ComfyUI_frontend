export interface ConnectivityExpectations {
  isolatedNodeTypes: Record<string, { pack: string; reason: string }>
  connectRejected: PairExpectationGroup[]
  deterministicSlotContractMismatch: PairExpectationGroup[]
  dynamicSlotCleanupStalled: PairExpectationGroup[]
  roundtripLost: PairExpectationGroup[]
  zeroPairDragExpectedNodeCounts: Partial<Record<string, number>>
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

export function pairExpectationNodeTypes(
  groups: PairExpectationGroup[]
): string[] {
  const nodeTypes = new Set<string>()
  for (const key of pairExpectationKeys(groups)) {
    const sides = key.split(' -> ')
    if (sides.length !== 2) throw new Error(`${key}: invalid pair key`)
    for (const side of sides) {
      const separator = side.lastIndexOf('.')
      if (separator <= 0 || separator === side.length - 1)
        throw new Error(`${key}: invalid pair endpoint`)
      nodeTypes.add(side.slice(0, separator))
    }
  }
  return [...nodeTypes].sort()
}

export const pairEndpointPacks: Readonly<Record<string, string>> = {
  ACN_SparseCtrlLoaderAdvanced: 'comfyui-advanced-controlnet',
  ADE_AnimateDiffCombine: 'comfyui-animatediff-evolved',
  ADE_ValueScheduling: 'comfyui-animatediff-evolved',
  AddLabel: 'ComfyUI-KJNodes',
  AddTextPrefix: 'core',
  AdjustBrightness: 'core',
  'Basic data handling: Boolean And': 'basic_data_handling',
  CompositorTools3: 'comfyui-enricos-nodes',
  FL_CodeNode: 'ComfyUI_Fill-Nodes',
  FL_NodeLoader: 'ComfyUI_Fill-Nodes',
  FL_NodePackLoader: 'ComfyUI_Fill-Nodes',
  FL_VideoBatchSplitter: 'ComfyUI_Fill-Nodes',
  'MathExpression|pysssss': 'ComfyUI-Custom-Scripts',
  MultiImageLoader: 'WhatDreamsCost-ComfyUI',
  VHS_SelectLatest: 'comfyui-videohelpersuite',
  Vewd: 'vewd'
}

export function pairEndpointOwnershipIssues(
  requiredNodeTypes: string[],
  nodes: Array<{ type: string; pack: string }>,
  installedPacks: ReadonlySet<string>,
  endpointPacks: Readonly<Record<string, string>> = pairEndpointPacks
): string[] {
  const installed = new Set(
    [...installedPacks].map((pack) => pack.toLowerCase())
  )
  return requiredNodeTypes.flatMap((nodeType) => {
    const expectedPack = endpointPacks[nodeType]
    if (!expectedPack)
      return [`${nodeType}: no endpoint pack attribution exists`]
    if (expectedPack !== 'core' && !installed.has(expectedPack.toLowerCase()))
      return []
    const node = nodes.find((candidate) => candidate.type === nodeType)
    if (!node) return [`${nodeType}: not registered by ${expectedPack}`]
    return node.pack.toLowerCase() === expectedPack.toLowerCase()
      ? []
      : [`${nodeType}: expected ${expectedPack}, observed ${node.pack}`]
  })
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
        (_, index) =>
          `MultiImageLoader.image_${index + 1} -> ADE_AnimateDiffCombine.images`
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
          `FL_VideoBatchSplitter.batch_${index + 5} -> AdjustBrightness.images`
      ),
      reason:
        'FL_VideoBatchSplitter exposes only the default 4 of 20 declared outputs',
      restore:
        'make object_info describe only materialized outputs and remove this entry'
    }
  ],
  dynamicSlotCleanupStalled: [
    {
      id: 'fill-code-node-dynamic-cleanup-hang',
      pack: 'ComfyUI_Fill-Nodes',
      pairs: [
        'Basic data handling: Boolean And.BOOLEAN -> FL_CodeNode.use_file',
        'Basic data handling: Boolean And.BOOLEAN -> FL_CodeNode.run_always'
      ],
      reason:
        'FL_CodeNode enters a synchronous loop when its 25ms dynamic-slot cleanup repeatedly removes the fixed use_file or run_always index',
      restore:
        'advance or remove the current dynamic slot during cleanup and remove this entry when both pairs complete'
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
        'ADE_ValueScheduling.INT -> Vewd.max_frames'
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
