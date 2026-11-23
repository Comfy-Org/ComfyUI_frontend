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
  it('parses the built-in skills response from /agent/skills/builtin', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      Response.json({
        skills: [
          { name: 'batch-generation', description: 'Run a batch of images' }
        ]
      })
    )

    await expect(listBuiltinSkills()).resolves.toEqual([
      { name: 'batch-generation', description: 'Run a batch of images' }
    ])
    expect(api.fetchApi).toHaveBeenCalledWith('/agent/skills/builtin')
  })

  it('preserves HTTP 404 errors as SkillPacksApiError', async () => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      Response.json(
        { error: 'Built-in skills listing is disabled' },
        { status: 404 }
      )
    )

    await expect(listBuiltinSkills()).rejects.toMatchObject({
      name: 'SkillPacksApiError',
      status: 404,
      message: 'Built-in skills listing is disabled'
    })
  })
})
