import { describe, expect, it } from 'vitest'

import {
  buildWorkflowFolder,
  deploymentWorkflowFolder
} from '@/platform/workspace/buildWorkflows'

const ID = '0f3c9a7e-5b21-4c8d-9e2a-1b2c3d4e5f60'

describe('buildWorkflowFolder', () => {
  it("is the Build's name and the start of its id, as Platform saves it", () => {
    expect(buildWorkflowFolder({ id: ID, name: 'Portrait studio' })).toBe(
      'Portrait studio (0f3c9a7e)'
    )
  })

  it.for([
    ['a folder separator', 'a/b\\c', 'a-b-c (0f3c9a7e)'],
    ['a parent folder', '../../settings', '-.-settings (0f3c9a7e)'],
    ['edge dots and spaces', ' .hidden. ', 'hidden (0f3c9a7e)'],
    ['a name with nothing left', '...', 'New Build (0f3c9a7e)'],
    ['a blank name', '', 'New Build (0f3c9a7e)'],
    ['a comma', 'a, b', 'a- b (0f3c9a7e)']
  ])('cleans %s the way Platform does', ([, name, folder]) => {
    expect(buildWorkflowFolder({ id: ID, name })).toBe(folder)
  })
})

describe('deploymentWorkflowFolder', () => {
  const deployment = {
    deployment_id: 'dep-1',
    release_id: 'rel-1',
    can_start: true,
    created_at: '2026-11-20T00:00:00Z',
    status: 'ready' as const
  }

  it('is the folder of the Build the deployment runs', () => {
    expect(
      deploymentWorkflowFolder({
        ...deployment,
        build_id: ID,
        build_name: 'Studio'
      })
    ).toBe('Studio (0f3c9a7e)')
  })

  it.for([
    { build_name: 'Studio' },
    { build_id: ID },
    { build_id: '', build_name: 'Studio' }
  ])('is null when the Build is not known: %o', (build) => {
    expect(deploymentWorkflowFolder({ ...deployment, ...build })).toBeNull()
  })

  it('is null for Comfy Cloud', () => {
    expect(deploymentWorkflowFolder(null)).toBeNull()
  })
})
