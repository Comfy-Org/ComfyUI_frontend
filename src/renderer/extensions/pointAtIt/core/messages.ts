import type { ReplySettingAddress } from './agentReply'
import { MODEL_PROXY_PORT } from './modelWire'
import type { SettingValue } from './targetAddress'

/** The one key of the layer; lower case, compared with `event.key`. */
export const MARK_KEY = 'q'

const keyLabel = MARK_KEY.toUpperCase()

/** How the send-right-away shortcut is written on this platform. */
export function sendNowKeyLabel(userAgent: string): string {
  return /Mac|iPhone|iPad/.test(userAgent) ? '⌘ Enter' : 'Ctrl Enter'
}

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
  answersComment: (label: string) => `Answers question · ${label}`,
  trayTitle: 'Questions for the agent',
  annotateTooltip: `Ask the agent about something on the canvas (${keyLabel})`,
  showPanel: 'Show questions and answers',
  hidePanel: 'Hide questions and answers',
  unsentCount: (count: number) =>
    count === 1 ? '1 unsent question' : `${count} unsent questions`,
  waitingShort: (seconds: number) => `${seconds} s`,
  noCommentsYet: `No questions yet. Press Ask or ${keyLabel}, then click what you want to ask about.`,
  annotate: 'Ask',
  annotateHint:
    'Click a node, a setting or a part of the interface to ask about it. Esc to leave.',
  commentPlaceholder: 'Your question',
  commentLabel: 'Question',
  commentHint: (sendKey: string) =>
    `Enter to add · ${sendKey} to send · Shift+Enter for a new line · Esc to close`,
  add: 'Add',
  save: 'Save',
  nothingToSend: 'Nothing to send yet: type a question first.',
  sendBlocked: {
    waiting: 'A request is already waiting for its reply.',
    followUp:
      'A follow-up is waiting for its reply. Send is available after it.',
    answerShowing: 'Close the answer on screen to send.'
  },
  remove: 'Delete',
  pinLabel: (number: number, label: string) => `Question ${number} on ${label}`,
  answeredPinLabel: (number: number, label: string) =>
    `Answered question ${number} on ${label}: open its thread`,
  targetMissing: 'target no longer in the workflow',
  send: (count: number) => `Send ${count}`,
  clear: 'Clear',
  cancel: 'Cancel',
  retry: 'Retry',
  waiting: (seconds: number) => `Waiting for the agent · ${seconds} s`,
  notOnScreen: 'not on screen right now',
  targetGoneNote: 'What this question points to is no longer in the workflow.',
  targetHiddenNote: 'What this question points to is not on screen right now.',
  turnStripLabel: 'Turns',
  turnDotLabel: (number: number, total: number, question: string) =>
    `Turn ${number} of ${total}: ${question}`,
  turnBarLabel: (first: number, last: number, title: string) =>
    `Turns ${first} to ${last}: ${title}`,
  nextTurnLabel: (unsent: number) =>
    unsent === 0
      ? 'Next turn: no questions yet'
      : `Next turn: ${unsent === 1 ? '1 unsent question' : `${unsent} unsent questions`}`,
  turnPosition: (number: number, total: number) => `turn ${number} of ${total}`,
  moreQuestions: (count: number) =>
    count === 1 ? '+1 more question' : `+${count} more questions`,
  turnCount: (count: number) => (count === 1 ? '1 turn' : `${count} turns`),
  turnQuestions: 'Questions of this turn',
  turnsOfBar: 'Turns in this group',
  startOver: 'Start over',
  startOverQuestion: 'Remove every turn and its answers?',
  startOverConfirm: 'Yes, start over',
  startOverKeep: 'Keep',
  noAnswerForComment: 'The agent gave no step for this question.',
  replayTargetGone: 'What this answer pointed at is no longer in the workflow.',
  replayHint: 'An earlier answer, shown again for reading.',
  threadLabel: 'Thread',
  threadYou: 'You',
  threadAgent: 'Agent',
  offeredNote: (
    setting: string,
    value: SettingValue,
    result: 'accepted' | 'changed' | null
  ) => {
    const outcome = {
      accepted: 'you accepted it',
      changed: 'you changed it yourself',
      none: 'not taken'
    }[result ?? 'none']
    return `Offered ${JSON.stringify(value)} for ${setting} · ${outcome}`
  },
  followUpLabel: 'Follow up',
  followUpHint: (sendKey: string) =>
    `Enter or ${sendKey} to send · Shift+Enter for a new line`,
  followUpWaiting: (seconds: number) => `Waiting for the reply · ${seconds} s`,
  followUpCount: (count: number) =>
    count === 1 ? '1 follow-up' : `${count} follow-ups`,
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
  earlierComment:
    'The agent tied this step to a question from an earlier turn; only this turn’s questions were sent to be answered.',
  outsideThread: (count: number) =>
    count === 1
      ? 'The agent added 1 step that does not belong to this thread; it was left out.'
      : `The agent added ${count} steps that do not belong to this thread; they were left out.`,
  unknownElement: (elementId: string) =>
    `The agent named interface element "${elementId}", which no question in this request is pinned on.`,
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
