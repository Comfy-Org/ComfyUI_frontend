import { describe, expect, it } from 'vitest'

import { readSavedWorkflowLink } from './savedWorkflowLink'

describe('saved workflow links', () => {
  it('reads a saved workflow in a named workspace without confusing it with a graph fragment', () => {
    expect(
      readSavedWorkflowLink({
        workflow: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
        workspace: 'workspace-1',
        deployment: 'dep-1'
      })
    ).toEqual({
      status: 'valid',
      workflowId: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      workspaceId: 'workspace-1',
      deploymentId: 'dep-1',
      environment: null
    })
  })

  it('allows the authenticated active workspace when no target is named', () => {
    expect(
      readSavedWorkflowLink({
        workflow: 'c327cae8-2acf-4bfa-bb88-97948a3c008b'
      })
    ).toEqual({
      status: 'valid',
      workflowId: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      workspaceId: null,
      deploymentId: null,
      environment: null
    })
  })

  it('reads an explicitly selected standard environment', () => {
    expect(
      readSavedWorkflowLink({
        workflow: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
        workspace: 'ws-1',
        environment: 'standard'
      })
    ).toEqual({
      status: 'valid',
      workflowId: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      workspaceId: 'ws-1',
      deploymentId: null,
      environment: 'standard'
    })
  })

  it('does nothing for a URL without a saved workflow', () => {
    expect(readSavedWorkflowLink({ share: 'public-snapshot' })).toEqual({
      status: 'absent'
    })
  })

  it.for([
    { workflow: null },
    { workflow: '' },
    { workflow: ['c327cae8-2acf-4bfa-bb88-97948a3c008b'] },
    { workflow: 'c327cae8-2acf-4bfa-bb88-97948a3c008b,another' },
    { workflow: '../userdata/private.json' },
    { workflow: 'https://untrusted.example/workflow.json' },
    { workflow: 'c327cae8-2acf-4bfa-bb88-97948a3c008b', workspace: null },
    { workflow: 'c327cae8-2acf-4bfa-bb88-97948a3c008b', workspace: '' },
    { workflow: 'c327cae8-2acf-4bfa-bb88-97948a3c008b', workspace: ['a', 'b'] },
    { workflow: 'c327cae8-2acf-4bfa-bb88-97948a3c008b', workspace: 'a,b' },
    { workflow: 'c327cae8-2acf-4bfa-bb88-97948a3c008b', deployment: 'dep-1' },
    {
      workflow: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      environment: 'standard'
    },
    {
      workflow: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      workspace: 'ws-1',
      environment: 'standard',
      deployment: 'dep-1'
    },
    {
      workflow: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      workspace: 'ws-1',
      environment: 'other'
    },
    {
      workflow: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      workspace: 'ws-1',
      deployment: ['a', 'b']
    }
  ])('rejects a malformed or ambiguous private destination: %j', (query) => {
    expect(readSavedWorkflowLink(query)).toEqual({ status: 'invalid' })
  })
})
