import { describe, expect, it } from 'vitest'

import { readSavedWorkflowLink } from './savedWorkflowLink'

describe('saved workflow links', () => {
  it('reads a saved workflow in a named workspace without confusing it with a graph fragment', () => {
    expect(
      readSavedWorkflowLink({
        savedFile: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
        workspace: 'workspace-1',
        deployment: 'dep-1'
      })
    ).toEqual({
      status: 'valid',
      savedFileId: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      workspaceId: 'workspace-1',
      deploymentId: 'dep-1',
      environment: null
    })
  })

  it('allows the authenticated active workspace when no target is named', () => {
    expect(
      readSavedWorkflowLink({
        savedFile: 'c327cae8-2acf-4bfa-bb88-97948a3c008b'
      })
    ).toEqual({
      status: 'valid',
      savedFileId: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      workspaceId: null,
      deploymentId: null,
      environment: null
    })
  })

  it('reads an explicitly selected standard environment', () => {
    expect(
      readSavedWorkflowLink({
        savedFile: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
        workspace: 'ws-1',
        environment: 'standard'
      })
    ).toEqual({
      status: 'valid',
      savedFileId: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      workspaceId: 'ws-1',
      deploymentId: null,
      environment: 'standard'
    })
  })

  it('refuses legacy record links without reinterpreting their UUID', () => {
    expect(
      readSavedWorkflowLink({
        workflow: 'c327cae8-2acf-4bfa-bb88-97948a3c008b'
      })
    ).toEqual({ status: 'legacy' })
  })

  it('rejects mixed legacy and saved-file identities', () => {
    expect(
      readSavedWorkflowLink({
        workflow: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
        savedFile: 'c327cae8-2acf-4bfa-bb88-97948a3c008b'
      })
    ).toEqual({ status: 'invalid' })
  })

  it('does nothing for a URL without a saved workflow', () => {
    expect(readSavedWorkflowLink({ share: 'public-snapshot' })).toEqual({
      status: 'absent'
    })
  })

  it.for([
    { savedFile: null },
    { savedFile: '' },
    { savedFile: ['c327cae8-2acf-4bfa-bb88-97948a3c008b'] },
    { savedFile: 'c327cae8-2acf-4bfa-bb88-97948a3c008b,another' },
    { savedFile: '../userdata/private.json' },
    { savedFile: 'https://untrusted.example/workflow.json' },
    { savedFile: 'c327cae8-2acf-4bfa-bb88-97948a3c008b', workspace: null },
    { savedFile: 'c327cae8-2acf-4bfa-bb88-97948a3c008b', workspace: '' },
    {
      savedFile: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      workspace: ['a', 'b']
    },
    { savedFile: 'c327cae8-2acf-4bfa-bb88-97948a3c008b', workspace: 'a,b' },
    { savedFile: 'c327cae8-2acf-4bfa-bb88-97948a3c008b', deployment: 'dep-1' },
    {
      savedFile: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      environment: 'standard'
    },
    {
      savedFile: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      workspace: 'ws-1',
      environment: 'standard',
      deployment: 'dep-1'
    },
    {
      savedFile: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      workspace: 'ws-1',
      environment: 'other'
    },
    {
      savedFile: 'c327cae8-2acf-4bfa-bb88-97948a3c008b',
      workspace: 'ws-1',
      deployment: ['a', 'b']
    }
  ])('rejects a malformed or ambiguous private destination: %j', (query) => {
    expect(readSavedWorkflowLink(query)).toEqual({ status: 'invalid' })
  })
})
