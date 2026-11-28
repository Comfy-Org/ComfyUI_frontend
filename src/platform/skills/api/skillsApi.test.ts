import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { listBuiltinSkills, listSkillPacks } from './skillsApi'

vi.mock(import('@/scripts/api'))

describe('skill pack error responses', () => {
  it('preserves plain-text proxy failure messages', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      new Response('Upstream service unavailable', { status: 502 })
    )

    await expect(listSkillPacks()).rejects.toMatchObject({
      name: 'SkillPacksApiError',
      status: 502,
      message: 'Upstream service unavailable'
    })
  })

  it('keeps the loopback-only code and the host reason from the local agent', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      Response.json(
        {
          error: 'Open http://127.0.0.1:8188 to use the agent.',
          code: 'agent_loopback_only'
        },
        { status: 403 }
      )
    )

    await expect(listSkillPacks()).rejects.toMatchObject({
      name: 'SkillPacksApiError',
      status: 403,
      code: 'agent_loopback_only',
      message: 'Open http://127.0.0.1:8188 to use the agent.'
    })
  })

  it.for([
    {
      case: 'the error field',
      status: 400,
      body: { error: 'Instructions are required' },
      message: 'Instructions are required'
    },
    {
      case: 'the error field',
      status: 409,
      body: { error: 'Total size exceeds the configured budget' },
      message: 'Total size exceeds the configured budget'
    },
    {
      case: 'a message with a code',
      status: 404,
      body: { code: 'NOT_FOUND', message: 'Skills are unavailable' },
      message: 'Skills are unavailable'
    },
    {
      case: 'a message with an error code',
      status: 404,
      body: { error: 'NOT_FOUND', message: 'Skills are unavailable' },
      message: 'Skills are unavailable'
    }
  ])(
    'preserves HTTP $status and the corrective message from $case',
    async (testCase) => {
      vi.mocked(api.fetchApi).mockResolvedValue(
        Response.json(testCase.body, { status: testCase.status })
      )

      await expect(listSkillPacks()).rejects.toMatchObject({
        name: 'SkillPacksApiError',
        status: testCase.status,
        message: testCase.message
      })
    }
  )
})

describe('listBuiltinSkills', () => {
  it('returns ok with parsed skills from /agent/skills/builtin', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      Response.json({
        skills: [
          { name: 'batch-generation', description: 'Run a batch of images' }
        ]
      })
    )

    await expect(listBuiltinSkills()).resolves.toEqual({
      status: 'ok',
      skills: [
        { name: 'batch-generation', description: 'Run a batch of images' }
      ]
    })
    expect(api.fetchApi).toHaveBeenCalledWith('/agent/skills/builtin')
  })

  it('returns unavailable on HTTP 404 without throwing', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      Response.json(
        { code: 'NOT_FOUND', message: 'Skills are unavailable' },
        { status: 404 }
      )
    )

    await expect(listBuiltinSkills()).resolves.toEqual({
      status: 'unavailable'
    })
  })

  it('returns an error outcome with SkillPacksApiError on non-404 HTTP failures', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      Response.json({ error: 'Upstream unavailable' }, { status: 502 })
    )

    await expect(listBuiltinSkills()).resolves.toMatchObject({
      status: 'error',
      error: {
        name: 'SkillPacksApiError',
        status: 502,
        message: 'Upstream unavailable'
      }
    })
  })

  it('returns an error outcome on network, JSON, and schema failures', async () => {
    const networkError = new TypeError('Failed to fetch')
    vi.mocked(api.fetchApi).mockRejectedValueOnce(networkError)
    await expect(listBuiltinSkills()).resolves.toEqual({
      status: 'error',
      error: networkError
    })

    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      new Response('not json', { status: 200 })
    )
    await expect(listBuiltinSkills()).resolves.toMatchObject({
      status: 'error',
      error: expect.any(Error)
    })

    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      Response.json({ skills: [{ name: 42 }] })
    )
    await expect(listBuiltinSkills()).resolves.toMatchObject({
      status: 'error',
      error: expect.any(Error)
    })
  })
})
