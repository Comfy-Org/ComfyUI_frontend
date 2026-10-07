import { describe, expect, it } from 'vitest'

import type { MessagePart } from '../../../services/agent/agentMessageParts'
import { groupMessageParts } from './agentMessageGroup'

const deleteApproval: MessagePart = {
  type: 'deleteApproval',
  askId: 'delete-1',
  prompt: 'Delete 1 node?',
  nodes: [{ id: '12', name: 'KSampler' }],
  hiddenNodeCount: 0
}

describe('groupMessageParts', () => {
  it('gives every card its own group and folds the stand-in into a notice', () => {
    const parts: MessagePart[] = [
      { type: 'runApproval', askId: 'run-1' },
      deleteApproval,
      { type: 'askUnavailable', askId: 'odd-1' },
      { type: 'paywall' }
    ]

    expect(groupMessageParts(parts)).toEqual([
      { kind: 'runApproval', part: parts[0] },
      { kind: 'deleteApproval', part: deleteApproval },
      { kind: 'notice', part: parts[2] },
      { kind: 'paywall', part: parts[3] }
    ])
  })
})
