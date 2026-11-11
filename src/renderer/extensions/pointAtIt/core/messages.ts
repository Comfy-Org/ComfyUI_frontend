import type { ReplySettingAddress } from './agentReply'
import { MODEL_PROXY_PORT } from './modelWire'
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
  askWaiting: 'Thinking…',
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
  annotateHint:
    'Click a node, a setting or a part of the interface to comment on it. Esc to leave.',
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
  commentCount: (count: number) =>
    count === 1 ? '1 comment' : `${count} comments`,
  showComments: 'Show comments',
  hideComments: 'Hide comments',
  notOnScreen: 'not on screen right now',
  targetGoneNote: 'What this comment points to is no longer in the workflow.',
  targetHiddenNote: 'What this comment points to is not on screen right now.',
  thinking: 'Thinking',
  showThinking: 'Show the thinking',
  hideThinking: 'Hide the thinking',
  noThinking: 'The model returned no thinking for this request.'
}

const failureText = {
  malformed: () => 'The reply was not in the expected format.',
  provider: (detail: string) =>
    `The model provider returned an error (${detail}).`,
  proxyDown: () =>
    `Could not reach the local model proxy on 127.0.0.1:${MODEL_PROXY_PORT}. Start it with start-proxy.command.`,
  timeout: (detail: string) => `The model sent nothing for ${detail} s.`,
  noKey: (detail: string) => `The proxy cannot call the model: ${detail}`
}

/** The one sentence shown for a failed request. */
export function describeFailure(failure: {
  kind: keyof typeof failureText
  detail: string
}): string {
  return failureText[failure.kind](failure.detail)
}

export const problems = {
  unknownNode: (nodeId: string) =>
    `The agent named node "${nodeId}", which is not in this workflow.`,
  unknownElement: (elementId: string) =>
    `The agent named interface element "${elementId}", which no comment in this batch is pinned on.`,
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
  describeElement: (element: {
    label: string
    role: string
    context: string
  }) =>
    `This is the ${element.role} "${element.label}"${element.context ? ` in the ${element.context}` : ''}. The scripted agent only knows the workflow, so it cannot say more about the interface.`,
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
