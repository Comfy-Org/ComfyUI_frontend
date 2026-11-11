/** The one key that starts marking; lower case, compared with `event.key`. */
export const MARK_KEY = 'q'

const keyLabel = MARK_KEY.toUpperCase()

export const messages = {
  markingHint: `Marking. Drag around what you mean, or click a setting. Release ${keyLabel} to cancel.`,
  nothingMarked: 'Nothing marked',
  askPlaceholder: 'Ask about what you marked',
  askInputLabel: 'Question',
  askHint: 'Enter to ask · Esc to cancel',
  removeChip: (label: string) => `Remove ${label}`,
  thinking: 'Thinking…',
  thinkingHint: 'Esc to cancel',
  agentTag: 'agent',
  doItForMe: 'Do it for me',
  next: 'Next',
  done: 'Done',
  close: 'Close',
  editFailed: 'That setting did not accept the value.',
  stepOf: (index: number, total: number) =>
    `Step ${index} of ${total} · Esc to stop`,
  controlsTitle: 'Point at it · POC',
  controlsShow: 'Show demo controls',
  controlsHide: 'Hide demo controls',
  replyDelay: 'Reply delay',
  seconds: (seconds: number) => `${seconds} s`,
  wrongTarget: 'Point at the wrong node',
  heldKeyEntry: `Hold ${keyLabel} and drag`,
  selectionEntry: `Select nodes, then tap ${keyLabel}`,
  scriptedNote: 'Scripted answers, no model.'
}

export const answers = {
  sizeLead: (setting: string, value: number, wider: boolean) =>
    `This sets the picture's size. Change ${setting} to ${value} for a ${wider ? 'larger' : 'smaller'} frame.`,
  stepsLead: (value: number, more: boolean) =>
    `This is how many passes the sampler makes. Change steps to ${value} for ${more ? 'more detail' : 'a faster run'}.`,
  runNext: 'That is the change. Now run it to see the result.',
  noDescription: (label: string) =>
    `The node definition has no description for ${label}.`,
  describe: (label: string, description: string) => `${label}: ${description}`,
  nothingToDescribe: 'Mark a node or a setting first, then ask what it is.',
  noSizeNode:
    'I could not find a node with width and height settings in this workflow.',
  noStepsNode: 'I could not find a node with a steps setting in this workflow.',
  noScript: 'I have no scripted answer for that.',
  canAnswer: [
    'This demo can answer:',
    '• make the picture wider, taller, larger or smaller',
    '• more or fewer steps',
    '• what is this? (mark a node or a setting first)'
  ].join('\n')
}
