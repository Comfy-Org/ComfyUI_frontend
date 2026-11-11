import type { ReplySettingAddress } from './agentReply'
import type { SettingValue } from './targetAddress'

/** The one key of the layer; lower case, compared with `event.key`. */
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
    `${index} of ${total} · Esc to stop`,
  answersComment: (number: number, label: string) =>
    `Answers comment ${number} · ${label}`,
  trayTitle: 'Point at it · POC',
  annotate: 'Annotate',
  annotateKey: keyLabel,
  annotateHint: 'Click a node or a setting to comment on it. Esc to leave.',
  annotateIdle: `Press Annotate or ${keyLabel}, then click what you want to comment on.`,
  commentPlaceholder: 'Your comment',
  commentLabel: 'Comment',
  commentHint: 'Enter to save · Shift+Enter for a new line · Esc to close',
  save: 'Save',
  remove: 'Delete',
  pinLabel: (number: number, label: string) => `Comment ${number} on ${label}`,
  targetMissing: 'target no longer in the workflow',
  send: (count: number) => `Send ${count}`,
  clear: 'Clear',
  cancel: 'Cancel',
  retry: 'Retry',
  waiting: (seconds: number) => `Waiting for the agent · ${seconds} s`,
  controlsTitle: 'Demo controls',
  controlsShow: 'Show demo controls',
  controlsHide: 'Hide demo controls',
  replyDelay: 'Reply delay',
  seconds: (seconds: number) => `${seconds} s`,
  wrongTarget: 'Point at the wrong node',
  scriptedNote: 'Scripted answers, no model.'
}

/** The one sentence shown for a failed request. */
export const failureText = {
  malformed: 'The reply was not in the expected format.'
}

export const problems = {
  unknownNode: (nodeId: string) =>
    `The agent named node "${nodeId}", which is not in this workflow.`,
  unknownSetting: ({ nodeId, setting }: ReplySettingAddress) =>
    `The agent named setting "${setting}" on node "${nodeId}", which is not in this workflow.`,
  valueNotAccepted: (label: string, value: SettingValue) =>
    `The agent offered ${JSON.stringify(value)} for ${label}, which that setting does not accept.`
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
  noSizeNode:
    'I could not find a node with width and height settings in this workflow.',
  noStepsNode: 'I could not find a node with a steps setting in this workflow.',
  noScript: 'I have no scripted answer for that.',
  canAnswer: [
    'The scripted agent can answer:',
    '• make the picture wider, taller, larger or smaller',
    '• more or fewer steps',
    '• what is this?'
  ].join('\n')
}
