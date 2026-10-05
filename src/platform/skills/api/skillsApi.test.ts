import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import { listSkillPacks } from './skillsApi'

vi.mock(import('@/scripts/api'))

describe('skill pack error responses', () => {
  it.for([
    {
      status: 400,
      body: { error: 'Instructions are required' },
      message: 'Instructions are required'
    },
    {
      status: 409,
      body: { error: 'Total size exceeds the configured budget' },
      message: 'Total size exceeds the configured budget'
    },
    {
      status: 404,
      body: { code: 'NOT_FOUND', message: 'Skills are unavailable' },
      message: 'Skills are unavailable'
    },
    {
      status: 404,
      body: { error: 'NOT_FOUND', message: 'Skills are unavailable' },
      message: 'Skills are unavailable'
    }
  ])('preserves HTTP $status and the corrective message', async (testCase) => {
    vi.mocked(api.fetchApi).mockResolvedValue(
      Response.json(testCase.body, { status: testCase.status })
    )

    await expect(listSkillPacks()).rejects.toMatchObject({
      name: 'SkillPacksApiError',
      status: testCase.status,
      message: testCase.message
    })
  })
})
