import { describe, expect, it } from 'vitest'

import { WORKFLOW_CONTROL_BYTES } from './workshop-workflow-response'
import type { SavedWorkflow } from './workshop-workflow-storage'
import { workflowStorage } from './workshop-workflow-storage'

const workflowId = 'workflows/remove-background'
const runId = 'bafc696e-e5d4-42f1-9a3d-d01f82a0629b'

function record(): SavedWorkflow {
  return {
    version: 2,
    stage: 'run',
    runId,
    workflowId,
    definitionVersion: '1',
    cancelRequested: false
  }
}

describe('workflow recovery storage', () => {
  it.for([
    { name: 'a partial JSON write', raw: '{"version":1' },
    {
      name: 'an unsupported record version',
      raw: JSON.stringify({ ...record(), version: 3 })
    },
    {
      name: 'an invalid run identifier',
      raw: JSON.stringify({ ...record(), runId: '../other' })
    },
    {
      name: 'a foreign workflow',
      raw: JSON.stringify({ ...record(), workflowId: 'workflows/other' })
    },
    {
      name: 'credentials in a saved record',
      raw: JSON.stringify({ ...record(), token: 'private' })
    },
    {
      name: 'inline media bytes',
      raw: JSON.stringify({ ...record(), appInputs: { image: [1, 2, 3] } })
    },
    {
      name: 'an oversized record',
      raw: ' '.repeat(WORKFLOW_CONTROL_BYTES + 8193)
    }
  ])('ignores $name when restoring a page', ({ raw }) => {
    const storage = workflowStorage(
      { getItem: () => raw, setItem() {}, removeItem() {} },
      'alice:workspace',
      workflowId
    )
    expect(storage.read()).toBeUndefined()
  })

  it('clears only the current caller, workspace, and workflow recovery record', () => {
    const owner = workflowStorage(
      sessionStorage,
      'alice:workspace-a',
      workflowId
    )
    const otherUser = workflowStorage(
      sessionStorage,
      'bob:workspace-a',
      workflowId
    )
    const otherWorkspace = workflowStorage(
      sessionStorage,
      'alice:workspace-b',
      workflowId
    )
    const otherWorkflow = workflowStorage(
      sessionStorage,
      'alice:workspace-a',
      'workflows/other'
    )
    const saved = record()
    const another = { ...saved, workflowId: 'workflows/other' }
    owner.write(saved)
    otherUser.write(saved)
    otherWorkspace.write(saved)
    otherWorkflow.write(another)
    owner.clear()
    expect(owner.read()).toBeUndefined()
    expect(otherUser.read()).toEqual(saved)
    expect(otherWorkspace.read()).toEqual(saved)
    expect(otherWorkflow.read()).toEqual(another)
  })
})
