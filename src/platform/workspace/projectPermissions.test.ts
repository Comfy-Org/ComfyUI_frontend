import { describe, expect, it } from 'vitest'

import { listProjectsByRole } from '@/platform/workspace/api/__fixtures__/projects'
import { projectPermission } from '@/platform/workspace/projectPermissions'

describe('projectPermission', () => {
  it.for([
    {
      role: 'runner' as const,
      key: 'project.workflow' as const,
      value: 'read'
    },
    {
      role: 'builder' as const,
      key: 'project.workflow' as const,
      value: 'write'
    },
    {
      role: 'projectAdmin' as const,
      key: 'project.members' as const,
      value: 'write'
    },
    {
      role: 'owner' as const,
      key: 'project.deployments' as const,
      value: 'write'
    }
  ])('reads $key from the $role project', ({ role, key, value }) => {
    const project = listProjectsByRole[role].projects[1]
    expect(projectPermission(project, key)).toBe(value)
  })

  it('returns nothing when the project is missing or the key is absent', () => {
    expect(projectPermission(undefined, 'project.deployments')).toBeUndefined()
    expect(
      projectPermission(
        listProjectsByRole.runner.projects[1],
        'project.deployments'
      )
    ).toBeUndefined()
  })
})
