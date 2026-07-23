import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

import { describe, expect, it, vi } from 'vitest'

import {
  createGitHubMembershipLookup,
  validateMaintainerAssignees
} from './validate-maintainer'

function activeMember(login = 'maintainer') {
  return {
    membership: { state: 'active' },
    teamMembership: { state: 'active' },
    user: { login, suspended_at: null, type: 'User' }
  }
}

describe('validateMaintainerAssignees', () => {
  it('rejects an empty assignee list', async () => {
    const membershipFor = vi.fn()
    const result = await validateMaintainerAssignees([], membershipFor)

    expect(result.valid).toBe(false)
    expect(membershipFor).not.toHaveBeenCalled()
  })

  it('accepts an active human Comfy-Org member', async () => {
    const result = await validateMaintainerAssignees(
      [{ login: 'maintainer', type: 'User' }],
      vi.fn().mockResolvedValue(activeMember())
    )

    expect(result.valid).toBe(true)
  })

  it('rejects a pending organization membership', async () => {
    const result = await validateMaintainerAssignees(
      [{ login: 'maintainer', type: 'User' }],
      vi.fn().mockResolvedValue({
        membership: { state: 'pending' },
        teamMembership: { state: 'active' },
        user: { login: 'maintainer', suspended_at: null, type: 'User' }
      })
    )

    expect(result.valid).toBe(false)
  })

  it('rejects GitHub bot accounts even when they are organization members', async () => {
    const membershipFor = vi.fn().mockResolvedValue(activeMember())
    const result = await validateMaintainerAssignees(
      [{ login: 'automation[bot]', type: 'Bot' }],
      membershipFor
    )

    expect(result.valid).toBe(false)
    expect(membershipFor).not.toHaveBeenCalled()
  })

  it('rejects bot-like service users even when GitHub reports User', async () => {
    const membershipFor = vi
      .fn()
      .mockResolvedValue(activeMember('comfy-pr-bot'))
    const result = await validateMaintainerAssignees(
      [{ login: 'comfy-pr-bot', type: 'User' }],
      membershipFor
    )

    expect(result.valid).toBe(false)
    expect(membershipFor).not.toHaveBeenCalled()
  })

  it('rejects a human who is not an organization member', async () => {
    const result = await validateMaintainerAssignees(
      [{ login: 'contributor', type: 'User' }],
      vi.fn().mockResolvedValue({
        membership: null,
        teamMembership: null,
        user: { login: 'contributor', suspended_at: null, type: 'User' }
      })
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      'Assign at least one active human member of the Comfy-Org/comfy_frontend_devs team.'
    )
  })

  it('rejects an organization service user outside the human-only team', async () => {
    const result = await validateMaintainerAssignees(
      [{ login: 'comfyui-wiki', type: 'User' }],
      vi.fn().mockResolvedValue({
        membership: { state: 'active' },
        teamMembership: null,
        user: { login: 'comfyui-wiki', suspended_at: null, type: 'User' }
      })
    )

    expect(result.valid).toBe(false)
  })

  it('rejects a suspended organization member', async () => {
    const result = await validateMaintainerAssignees(
      [{ login: 'maintainer', type: 'User' }],
      vi.fn().mockResolvedValue({
        membership: { state: 'active' },
        teamMembership: { state: 'active' },
        user: {
          login: 'maintainer',
          suspended_at: '2026-07-11T00:00:00Z',
          type: 'User'
        }
      })
    )

    expect(result.valid).toBe(false)
  })

  it('checks later human assignees after rejecting an ineligible one', async () => {
    const membershipFor = vi
      .fn()
      .mockResolvedValueOnce({
        membership: null,
        teamMembership: null,
        user: { login: 'contributor', suspended_at: null, type: 'User' }
      })
      .mockResolvedValueOnce(activeMember('owner'))
    const result = await validateMaintainerAssignees(
      [
        { login: 'contributor', type: 'User' },
        { login: 'owner', type: 'User' }
      ],
      membershipFor
    )

    expect(result.valid).toBe(true)
    expect(membershipFor).toHaveBeenCalledTimes(2)
  })

  it('propagates a membership API failure so callers fail closed', async () => {
    await expect(
      validateMaintainerAssignees(
        [{ login: 'maintainer', type: 'User' }],
        vi.fn().mockRejectedValue(new Error('GitHub API unavailable'))
      )
    ).rejects.toThrow('GitHub API unavailable')
  })

  it('fails closed when the human-team membership API fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({ login: 'maintainer', type: 'User' }),
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({ state: 'active' }),
        ok: true,
        status: 200
      })
      .mockResolvedValueOnce({ ok: false, status: 503 })
    vi.stubGlobal('fetch', fetchMock)

    try {
      await expect(
        createGitHubMembershipLookup('token')('maintainer')
      ).rejects.toThrow('GitHub human-team membership lookup failed')
      expect(fetchMock.mock.calls[2][0]).toContain(
        '/teams/comfy_frontend_devs/memberships/maintainer'
      )
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('writes valid=false and exits nonzero when CLI setup fails', () => {
    const directory = mkdtempSync(join(tmpdir(), 'maintainer-policy-'))
    const eventPath = join(directory, 'event.json')
    const outputPath = join(directory, 'github-output.txt')
    writeFileSync(
      eventPath,
      JSON.stringify({
        pull_request: {
          assignees: [{ login: 'maintainer', type: 'User' }]
        }
      })
    )

    try {
      const result = spawnSync(
        process.execPath,
        ['scripts/cicd/validate-maintainer.ts', eventPath],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          env: {
            ...process.env,
            COMFY_ORG_MEMBERS_READ_TOKEN: '',
            GITHUB_OUTPUT: outputPath
          }
        }
      )

      expect(result.status).toBe(1)
      expect(result.stderr).toContain(
        '::error::COMFY_ORG_MEMBERS_READ_TOKEN is required.'
      )
      expect(readFileSync(outputPath, 'utf8')).toBe('valid=false\n')
    } finally {
      rmSync(directory, { force: true, recursive: true })
    }
  })
})
