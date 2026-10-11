import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

vi.mock(import('@/platform/telemetry/reportError'))

const { reportError } = await import('@/platform/telemetry/reportError')

describe('api.storeUserData', () => {
  it('resolves without reporting on a 200', async () => {
    vi.spyOn(api, 'fetchApi').mockResolvedValue(Response.json({}))

    await expect(
      api.storeUserData('workflows/My Workflow.json', { nodes: [] })
    ).resolves.toBeInstanceOf(Response)

    expect(reportError).not.toHaveBeenCalled()
  })

  // PM-2045: a thin feedback-survey report with no logs or stack frame — this
  // context (route, status, overwrite/full_info) is what the next occurrence
  // needs to actually diagnose the 405.
  it('reports the route, status and write options on a non-200', async () => {
    vi.spyOn(api, 'fetchApi').mockResolvedValue(
      new Response(null, { status: 405, statusText: 'Method Not Allowed' })
    )

    await expect(
      api.storeUserData(
        'workflows/Unsaved Workflow.json',
        { nodes: [] },
        {
          overwrite: true,
          stringify: true,
          throwOnError: true,
          full_info: false
        }
      )
    ).rejects.toThrow(
      "Error storing user data file 'workflows/Unsaved Workflow.json': 405 Method Not Allowed"
    )

    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        message:
          "Error storing user data file 'workflows/Unsaved Workflow.json': 405 Method Not Allowed"
      }),
      {
        errorType: 'userdata_store_failure',
        surface: 'platform',
        tags: {
          status: 405,
          overwrite: true,
          full_info: false
        },
        context: {
          file: 'workflows/Unsaved Workflow.json',
          route:
            '/userdata/workflows%2FUnsaved%20Workflow.json?overwrite=true&full_info=false'
        }
      }
    )
  })

  it('still reports a non-200 when the caller opts out of throwing', async () => {
    vi.spyOn(api, 'fetchApi').mockResolvedValue(
      new Response(null, { status: 409, statusText: 'Conflict' })
    )

    const resp = await api.storeUserData(
      'workflows/My Workflow.json',
      { nodes: [] },
      { overwrite: false, throwOnError: false }
    )

    expect(resp.status).toBe(409)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({ errorType: 'userdata_store_failure' })
    )
  })
})
