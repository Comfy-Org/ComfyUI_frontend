import { describe, expect, it } from 'vitest'

import type { Department, Role, RolesSnapshot } from './roles'

describe('Role interface (applyUrl rename)', () => {
  it('accepts an object with applyUrl as a valid Role', () => {
    const role: Role = {
      id: 'abc-123',
      title: 'Senior Software Engineer',
      department: 'Engineering',
      location: 'San Francisco',
      applyUrl: 'https://jobs.ashbyhq.com/comfy-org/abc-123/application'
    }

    expect(role.applyUrl).toBe(
      'https://jobs.ashbyhq.com/comfy-org/abc-123/application'
    )
    // jobUrl must not exist on a valid Role object
    expect('jobUrl' in role).toBe(false)
  })

  it('Role object has exactly the expected keys', () => {
    const role: Role = {
      id: 'xyz',
      title: 'Designer',
      department: 'Design',
      location: 'Remote',
      applyUrl: 'https://jobs.ashbyhq.com/comfy-org/xyz/application'
    }

    const keys = Object.keys(role).sort()
    expect(keys).toEqual(['applyUrl', 'department', 'id', 'location', 'title'])
  })

  it('Department contains roles with applyUrl', () => {
    const dept: Department = {
      name: 'ENGINEERING',
      key: 'engineering',
      roles: [
        {
          id: 'role-1',
          title: 'Software Engineer',
          department: 'Engineering',
          location: 'San Francisco',
          applyUrl: 'https://jobs.ashbyhq.com/comfy-org/role-1/application'
        }
      ]
    }

    expect(dept.roles[0]?.applyUrl).toMatch(
      /^https:\/\/jobs\.ashbyhq\.com\//
    )
    expect('jobUrl' in (dept.roles[0] ?? {})).toBe(false)
  })

  it('RolesSnapshot has fetchedAt and departments with applyUrl roles', () => {
    const snapshot: RolesSnapshot = {
      fetchedAt: '2026-05-20T00:00:00.000Z',
      departments: [
        {
          name: 'DESIGN',
          key: 'design',
          roles: [
            {
              id: 'designer-1',
              title: 'Senior Product Designer',
              department: 'Design',
              location: 'San Francisco',
              applyUrl:
                'https://jobs.ashbyhq.com/comfy-org/designer-1/application'
            }
          ]
        }
      ]
    }

    expect(snapshot.fetchedAt).toBe('2026-05-20T00:00:00.000Z')
    expect(snapshot.departments).toHaveLength(1)
    const role = snapshot.departments[0]?.roles[0]
    expect(role?.applyUrl).toMatch(/\/application$/)
  })

  it('applyUrl can point to an /application path (regression: was jobUrl without /application)', () => {
    // Previously roles used jobUrl which linked to the job description page.
    // Now applyUrl links to the application form (ending in /application).
    const role: Role = {
      id: 'r1',
      title: 'Growth Engineer',
      department: 'Engineering',
      location: 'San Francisco',
      applyUrl:
        'https://jobs.ashbyhq.com/comfy-org/f1fdde76-84ae-48c1-b0f9-9654dd8e7de5/application'
    }

    expect(role.applyUrl).toContain('/application')
    expect(role.applyUrl).toMatch(/^https:\/\/jobs\.ashbyhq\.com\//)
  })
})
