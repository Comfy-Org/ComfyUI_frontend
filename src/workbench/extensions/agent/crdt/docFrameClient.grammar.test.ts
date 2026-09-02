import { describe, expect, it } from 'vitest'

import {
  awarenessFrame,
  docOpsResultFrame,
  docResetFrame,
  docSubscribedFrame,
  docUpdateFrame
} from './__fixtures__/docFrameClient'
import { parseServerDocFrame } from './docFrameClient'

const validFrames = [
  docUpdateFrame({
    workflow_id: 'workflow_1-ABC',
    actor: 'agent:thread-1:turn-1'
  }),
  docSubscribedFrame({ workflow_id: 'workflow_1-ABC' }),
  docOpsResultFrame({ workflow_id: 'workflow_1-ABC', seq: 1 }),
  docResetFrame({ workflow_id: 'workflow_1-ABC' }),
  awarenessFrame({
    workflow_id: 'workflow_1-ABC',
    actor: 'human:user-1:tab-1'
  })
]

const invalidWorkflowIds: [string, string][] = [
  ['an empty workflow_id', ''],
  ['a workflow_id containing whitespace', 'workflow invalid'],
  ['a workflow_id exceeding 128 encoded bytes', 'w'.repeat(129)],
  ['a workflow_id containing invalid characters', 'workflow:invalid']
]

const invalidActors: [string, string][] = [
  ['an actor exceeding 256 encoded bytes', `human:${'u'.repeat(250)}:tab`],
  ['an actor outside the closed actor grammar', 'operator:user:tab']
]

describe('document frame identifier grammar', () => {
  it.for(invalidWorkflowIds)('rejects %s', ([_name, workflowId]) => {
    expect(
      parseServerDocFrame(docSubscribedFrame({ workflow_id: workflowId }))
    ).toBeNull()
  })

  it.for(invalidActors)('rejects %s', ([_name, actor]) => {
    expect(parseServerDocFrame(awarenessFrame({ actor }))).toBeNull()
  })

  it.for(validFrames)('accepts valid identifiers in $type', (frame) => {
    expect(parseServerDocFrame(frame)).not.toBeNull()
  })
})
