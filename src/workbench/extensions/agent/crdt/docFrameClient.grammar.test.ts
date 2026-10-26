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
  ['a workflow_id containing a colon', 'workflow:invalid'],
  ['a workflow_id containing an asterisk', 'workflow*invalid'],
  ['a workflow_id containing a question mark', 'workflow?invalid'],
  ['a workflow_id containing an opening bracket', 'workflow[invalid'],
  ['a workflow_id containing a closing bracket', 'workflow]invalid'],
  ['a workflow_id containing a null byte', 'workflow\0invalid'],
  ['a workflow_id containing a newline', 'workflow\ninvalid'],
  ['a workflow_id containing a carriage return', 'workflow\rinvalid'],
  ['a workflow_id containing a tab', 'workflow\tinvalid']
]

const invalidActors: [string, string][] = [
  ['an empty actor', ''],
  ['an actor with an extra segment', 'human:user:tab:extra'],
  ['an actor with a missing segment', 'human:user'],
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

  it('accepts identifiers at their inclusive encoded-byte limits', () => {
    expect(
      parseServerDocFrame(
        awarenessFrame({
          workflow_id: 'w'.repeat(128),
          actor: `human:${'u'.repeat(248)}:t`
        })
      )
    ).not.toBeNull()
  })

  it.for(['workflow/path', 'workflow\\path', 'workflow..id', '工作流-1'])(
    'accepts workflow_id %j allowed by cloud ValidWorkflowID',
    (workflowId) => {
      expect(
        parseServerDocFrame(docSubscribedFrame({ workflow_id: workflowId }))
      ).not.toBeNull()
    }
  )
})
