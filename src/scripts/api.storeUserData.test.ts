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
  // context (route template, status, overwrite/full_info) is what the next
  // occurrence needs to actually diagnose the 405. The reported message and
  // route template deliberately omit the file name: it's unbounded
  // cardinality and would fragment grouping into one bucket per file instead
  // of one for this failure mode (the file itself is still carried in
  // `context.file` for debugging a specific occurrence).
  it('reports status and write options on a non-200, without the file name in the message', async () => {
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
        message: 'Error storing user data file: 405 Method Not Allowed'
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
          route: '/userdata/{file}?overwrite=true&full_info=false'
        }
      }
    )
  })

  // CodeRabbit flagged the route and the reported tags resolving
  // overwrite/full_info independently, which could disagree when a caller
  // omits them — assert they agree on the same (defaulted) values.
  it('resolves overwrite/full_info the same way for the request and the report', async () => {
    const fetchApiSpy = vi
      .spyOn(api, 'fetchApi')
      .mockResolvedValue(
        new Response(null, { status: 500, statusText: 'Server Error' })
      )

    await expect(
      api.storeUserData(
        'workflows/My Workflow.json',
        { nodes: [] },
        {
          throwOnError: false
        }
      )
    ).resolves.toBeInstanceOf(Response)

    expect(fetchApiSpy).toHaveBeenCalledExactlyOnceWith(
      '/userdata/workflows%2FMy%20Workflow.json?overwrite=true&full_info=false',
      expect.anything()
    )
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({
        tags: { status: 500, overwrite: true, full_info: false }
      })
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
