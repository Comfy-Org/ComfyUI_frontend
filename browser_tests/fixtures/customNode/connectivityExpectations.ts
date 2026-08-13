export interface ConnectivityExpectations {
  connectRejected: string[]
  conditionalSlotContractMismatch: string[]
  deterministicSlotContractMismatch: string[]
  roundtripLost: string[]
  zeroPairDragExpectedNodeCounts: Partial<Record<string, number>>
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
    'AddTextPrefix.texts -> VHS_SelectLatest.filename_prefix',
    'AddTextPrefix.texts -> VHS_SelectLatest.filename_postfix',
    'VHS_SelectLatest.Filename -> AddLabel.font_color'
  ],
  zeroPairDragExpectedNodeCounts: {}
}
