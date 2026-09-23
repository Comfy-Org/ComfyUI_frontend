import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import type { CloudWorkflowEntry } from '../../schemas/agentApiSchema'

vi.mock(import('@/scripts/api'))
const fetchApi = vi.mocked(api.fetchApi)

import { AgentApiError, createAgentRestClient } from './agentRestClient'
import type { AgentRestClient } from './agentRestClient'

function jsonResponse(
  status: number,
  body: unknown,
  headers?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  })
}

function respond(response: Response) {
  fetchApi.mockResolvedValueOnce(response)
}

function lastCall(): { route: string; init: RequestInit } {
  const [route, init] = fetchApi.mock.calls.at(-1)!
  return { route, init: init ?? {} }
}

function contentType(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string> | undefined)?.['Content-Type']
}

const makeClient = createAgentRestClient

async function retryAfterSeconds(
  header: string | null
): Promise<number | undefined> {
  respond(
    jsonResponse(
      503,
      { error: 'unavailable' },
      header === null ? undefined : { 'Retry-After': header }
    )
  )

  try {
    await makeClient().postMessage('thread-1', { content: 'hi' })
    throw new Error('Expected postMessage to reject')
  } catch (error) {
    if (!(error instanceof AgentApiError)) throw error
    return error.retryAfterSeconds
  }
}

const turnAccepted = {
  message_id: 'm1',
  thread_id: 't1',
  workflow_id: 'w1'
}

beforeEach(() => {
  fetchApi.mockReset()
})

describe('agentRestClient route + method', () => {
  it('postMessage targets the literal "new" thread path to open a thread', async () => {
    respond(jsonResponse(202, turnAccepted))
    await makeClient().postMessage('new', { content: 'hi' })

    const { route, init } = lastCall()
    expect(route).toBe('/agent/threads/new/messages')
    expect(init.method).toBe('POST')
  })

  it('percent-encodes a hostile thread id instead of retargeting the path', async () => {
    respond(jsonResponse(202, turnAccepted))
    await makeClient().postMessage('t1/x', { content: 'hi' })

    expect(lastCall().route).toBe('/agent/threads/t1%2Fx/messages')
  })

  it.for([undefined, [], [{ workflow_id: 'ref', name: 'Reference' }]])(
    'serializes explicit workflow references independently of open tabs: %j',
    async (workflowReferences) => {
      respond(jsonResponse(202, turnAccepted))
      const input = {
        content: 'compare',
        workflowId: 'target',
        tabs: { open_tabs: [{ workflow_id: 'ordinary', name: 'Ordinary' }] },
        workflowReferences
      }
      await makeClient().postMessage('new', input)
      const body = JSON.parse(lastCall().init.body as string)
      expect(body.open_tabs).toEqual(input.tabs.open_tabs)
      expect(body.workflow_id).toBe('target')
      if (workflowReferences === undefined)
        expect(body).not.toHaveProperty('workflow_references')
      else expect(body.workflow_references).toEqual(workflowReferences)
    }
  )

  it('getMessages GETs the thread messages path', async () => {
    respond(jsonResponse(200, []))
    await makeClient().getMessages('t7/x')

    const { route, init } = lastCall()
    expect(route).toBe('/agent/threads/t7%2Fx/messages')
    expect(init.method).toBe('GET')
  })

  it('getDraft GETs and validates the encoded workflow snapshot', async () => {
    const draft = {
      content: { version: 0.4, nodes: [], links: [] },
      version: 3
    }
    respond(jsonResponse(200, draft))

    await expect(makeClient().getDraft('wf/x')).resolves.toEqual(draft)
    expect(lastCall()).toMatchObject({
      route: '/agent/draft?workflow_id=wf%2Fx',
      init: { method: 'GET' }
    })
  })

  it('rejects a malformed draft snapshot', async () => {
    respond(jsonResponse(200, { content: [], version: -1 }))

    await expect(makeClient().getDraft('wf-1')).rejects.toThrow()
  })

  it('gets and puts the run-mode preference using the API contract', async () => {
    const preference = { mode: 'auto_limited' as const, credit_limit: 25 }
    const client: AgentRestClient = createAgentRestClient()
    respond(jsonResponse(200, preference))

    await expect(client.getRunMode()).resolves.toEqual(preference)
    expect(lastCall()).toMatchObject({
      route: '/agent/run-mode',
      init: { method: 'GET' }
    })

    respond(jsonResponse(200, preference))
    await client.putRunMode(preference)
    const { route, init } = lastCall()
    expect(route).toBe('/agent/run-mode')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual(preference)
  })

  it('accepts unlimited auto mode with a null credit limit', async () => {
    const preference = { mode: 'auto' as const, credit_limit: null }
    respond(jsonResponse(200, preference))

    await expect(createAgentRestClient().getRunMode()).resolves.toEqual(
      preference
    )
  })

  it('rejects a non-positive limited mode response', async () => {
    respond(jsonResponse(200, { mode: 'auto_limited', credit_limit: 0 }))

    await expect(createAgentRestClient().getRunMode()).rejects.toThrow()
  })

  it('cancelMessage POSTs the cancel path with an empty JSON body', async () => {
    respond(jsonResponse(202, { status: 'cancelling' }))
    await makeClient().cancelMessage('t7/x', 'm3/y')

    const { route, init } = lastCall()
    expect(route).toBe('/agent/threads/t7%2Fx/messages/m3%2Fy/cancel')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{}')
  })

  it('answerAsk POSTs the selected option to the encoded ask path', async () => {
    respond(jsonResponse(202, { status: 'answered' }))
    await makeClient().answerAsk('t7/x', 'turn-1:call/1', ['run'])

    const { route, init } = lastCall()
    expect(route).toBe('/agent/threads/t7%2Fx/asks/turn-1%3Acall%2F1/answer')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ selected: ['run'] })
  })

  it('listCloudWorkflows GETs the paginated workflows path until has_more is false', async () => {
    const page = (
      offset: number,
      data: CloudWorkflowEntry[],
      hasMore: boolean,
      nextCursor?: string
    ) =>
      jsonResponse(200, {
        data,
        pagination: {
          offset,
          limit: 100,
          total: data.length,
          has_more: hasMore,
          next_cursor: nextCursor
        }
      })
    respond(page(0, [{ id: 'wf-1', name: 'one' }], true, 'next page'))
    respond(page(1, [{ id: 'wf-2', name: 'two' }], false))

    const workflows = await makeClient().listCloudWorkflows()

    expect(fetchApi.mock.calls[0][0]).toBe('/workflows?limit=100')
    expect(fetchApi.mock.calls[1][0]).toBe(
      '/workflows?limit=100&after=next%20page'
    )
    expect(workflows.map((w) => w.id)).toEqual(['wf-1', 'wf-2'])
  })

  it('stops pagination when the server does not provide a new cursor', async () => {
    respond(
      jsonResponse(200, {
        data: [],
        pagination: { offset: 0, limit: 100, total: 0, has_more: true }
      })
    )

    await makeClient().listCloudWorkflows()

    expect(fetchApi).toHaveBeenCalledTimes(1)
  })

  it('stops when pagination cycles through previously seen cursors', async () => {
    for (const cursor of ['a', 'b', 'a']) {
      respond(
        jsonResponse(200, {
          data: [],
          pagination: {
            offset: 0,
            limit: 100,
            total: 0,
            has_more: true,
            next_cursor: cursor
          }
        })
      )
    }
    await makeClient().listCloudWorkflows()
    expect(fetchApi).toHaveBeenCalledTimes(3)
  })

  it('includes saved workflows beyond the fifth page', async () => {
    for (let page = 0; page < 6; page++) {
      respond(
        jsonResponse(200, {
          data: [{ id: `wf-${page}`, name: `Workflow ${page}` }],
          pagination: {
            offset: page,
            limit: 100,
            total: 6,
            has_more: page < 5,
            next_cursor: `page-${page + 1}`
          }
        })
      )
    }
    expect(
      (await makeClient().listCloudWorkflows()).map(({ id }) => id)
    ).toEqual(['wf-0', 'wf-1', 'wf-2', 'wf-3', 'wf-4', 'wf-5'])
  })
})

describe('postMessage wire body', () => {
  it('uses snake_case workflow_id and includes only the keys provided', async () => {
    respond(jsonResponse(202, turnAccepted))
    await makeClient().postMessage('t1', {
      content: 'build it',
      workflowId: 'wf-9',
      selection: { nodeId: 3 },
      attachments: ['a1']
    })

    const { init } = lastCall()
    const parsed = JSON.parse(init.body as string) as Record<string, unknown>
    expect(parsed).toEqual({
      content: 'build it',
      workflow_id: 'wf-9',
      selection: { nodeId: 3 },
      attachments: ['a1']
    })
    expect(contentType(init)).toBe('application/json')
  })

  it('omits absent optionals rather than sending them as undefined keys', async () => {
    respond(jsonResponse(202, turnAccepted))
    await makeClient().postMessage('t1', { content: 'just text' })

    const parsed = JSON.parse(lastCall().init.body as string) as Record<
      string,
      unknown
    >
    expect(Object.keys(parsed)).toEqual(['content'])
  })

  it('includes draft.content (and omits version when absent) when a draft is provided', async () => {
    respond(jsonResponse(202, turnAccepted))
    await makeClient().postMessage('t1', {
      content: "what's on my canvas",
      draft: { content: { nodes: [{ id: 1, type: 'LoadImage' }], links: [] } }
    })

    expect(JSON.parse(String(lastCall().init.body))).toEqual({
      content: "what's on my canvas",
      draft: { content: { nodes: [{ id: 1, type: 'LoadImage' }], links: [] } }
    })
  })

  it('forwards draft.version when the client has previously seen one', async () => {
    respond(jsonResponse(202, turnAccepted))
    await makeClient().postMessage('t1', {
      content: 'edit it',
      draft: { content: { nodes: [], links: [] }, version: 4 }
    })

    expect(JSON.parse(String(lastCall().init.body))).toMatchObject({
      draft: { version: 4 }
    })
  })
})

describe('uploadImage multipart', () => {
  it('posts FormData with the blob appended under "image" with the filename, no manual Content-Type', async () => {
    respond(jsonResponse(200, { name: 'x.png', subfolder: '', type: 'input' }))
    const appendSpy = vi.spyOn(FormData.prototype, 'append')
    const blob = new Blob(['bytes'], { type: 'image/png' })
    const controller = new AbortController()
    await makeClient().uploadImage(blob, 'x.png', controller.signal)

    const { route, init } = lastCall()
    expect(route).toBe('/upload/image')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect(init.signal).toBe(controller.signal)
    expect(appendSpy).toHaveBeenCalledWith('image', blob, 'x.png')
    expect(contentType(init)).toBeUndefined()
    appendSpy.mockRestore()
  })
})

describe('success response parsing', () => {
  it('parses the postMessage 202 through zAgentTurnAccepted, keeping extra workflow_id', async () => {
    respond(jsonResponse(202, turnAccepted))

    const result = await makeClient().postMessage('t1', { content: 'hi' })

    expect(result.message_id).toBe('m1')
    expect(result.thread_id).toBe('t1')
    expect((result as Record<string, unknown>).workflow_id).toBe('w1')
  })

  it.for([
    {
      name: 'an incomplete thread row',
      response: {
        threads: [{ id: 'th-1', title: 'Thread' }],
        pagination: { has_more: false, limit: 20, offset: 0, total: 1 }
      },
      path: ['threads', 0, 'created_at']
    },
    {
      name: 'incomplete pagination',
      response: {
        threads: [],
        pagination: { has_more: false }
      },
      path: ['pagination', 'limit']
    }
  ])('rejects $name from the agent service', async ({ response, path }) => {
    respond(jsonResponse(200, response))

    await expect(makeClient().listThreads()).rejects.toMatchObject({
      name: 'ZodError',
      issues: expect.arrayContaining([expect.objectContaining({ path })])
    })
  })
})

describe('error mapping', () => {
  it('maps a plain-string error body to its message with the status and parsed body', async () => {
    respond(jsonResponse(409, { error: 'turn is not running' }))

    const error = await makeClient()
      .cancelMessage('t1', 'm1')
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(AgentApiError)
    const apiError = error as AgentApiError
    expect(apiError.message).toBe('turn is not running')
    expect(apiError.status).toBe(409)
    expect(apiError.body).toEqual({ error: 'turn is not running' })
  })

  it('reads the ingest-shaped {error:{message,type}} nested message', async () => {
    respond(
      jsonResponse(403, {
        error: { message: 'access denied', type: 'forbidden' }
      })
    )

    const error = await makeClient()
      .getMessages('t-x')
      .catch((e: unknown) => e)

    expect((error as AgentApiError).message).toBe('access denied')
    expect((error as AgentApiError).status).toBe(403)
  })

  it('retains the Agent admission body and Retry-After delay', async () => {
    const body = {
      error: {
        message: 'Billing status is temporarily unavailable; please retry.',
        type: 'SERVICE_UNAVAILABLE',
        reason: 'funds_unavailable'
      }
    }
    respond(jsonResponse(503, body, { 'Retry-After': '5' }))

    const error = await makeClient()
      .postMessage('t1', { content: 'try it' })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(AgentApiError)
    const apiError = error as AgentApiError
    expect(apiError.message).toBe(body.error.message)
    expect(apiError.body).toEqual(body)
    expect(Reflect.get(apiError, 'retryAfterSeconds')).toBe(5)
  })

  it('falls back to statusText and undefined body for a non-JSON error response', async () => {
    respond(
      new Response('gateway boom', { status: 502, statusText: 'Bad Gateway' })
    )

    const error = await makeClient()
      .getMessages('t1')
      .catch((e: unknown) => e)

    if (!(error instanceof AgentApiError)) throw error
    expect(error.message).toBe('Bad Gateway')
    expect(error.status).toBe(502)
    expect(error.body).toBeUndefined()
  })

  it('throws zod when a success body violates the response schema (anti-drift)', async () => {
    respond(jsonResponse(200, { wrong: 'shape' }))

    const error = await makeClient()
      .getMessages('t-1')
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(AgentApiError)
  })
})

describe('Retry-After contract', () => {
  it.for([
    { label: 'absent header', header: null, expected: undefined },
    { label: 'integer delta-seconds', header: '5', expected: 5 },
    { label: 'zero delta-seconds', header: '0', expected: 0 },
    { label: 'malformed HTTP-date', header: 'not-a-date', expected: undefined },
    {
      label: 'HTTP-date shaped but unparseable',
      header: 'Wed, 99 Foo 2026 07:28:00 GMT',
      expected: undefined
    },
    { label: 'empty header', header: '', expected: undefined },
    { label: 'fractional delta-seconds', header: '1.5', expected: undefined },
    { label: 'negative delta-seconds', header: '-1', expected: undefined },
    {
      label: 'unsafe-integer delta-seconds',
      header: '9007199254740993',
      expected: undefined
    },
    {
      label: 'overflowing delta-seconds',
      header: '9'.repeat(400),
      expected: undefined
    }
  ])('returns $expected for a $label', async ({ header, expected }) => {
    expect(await retryAfterSeconds(header)).toBe(expected)
  })

  it.for([
    { header: 'Wed, 21 Oct 2026 07:28:00 GMT', expected: 30 },
    { header: 'Wed, 21 Oct 2026 07:27:00 GMT', expected: 0 }
  ])('reads the HTTP-date $header as a delay', async ({ header, expected }) => {
    vi.setSystemTime(new Date('2026-10-21T07:27:30Z'))

    expect(await retryAfterSeconds(header)).toBe(expected)
  })

  it.for([
    { label: 'RFC 850', header: 'Wednesday, 21-Oct-26 07:28:00 GMT' },
    { label: 'asctime', header: 'Wed Oct 21 07:28:00 2026' }
  ])('accepts the obsolete $label form of HTTP-date', async ({ header }) => {
    vi.setSystemTime(new Date('2026-10-21T07:27:30Z'))

    expect(await retryAfterSeconds(header)).toBe(30)
  })

  it('reads a space-padded asctime day as UTC, not as local time', async () => {
    vi.setSystemTime(new Date('1994-11-06T08:49:07Z'))

    expect(await retryAfterSeconds('Sun Nov  6 08:49:37 1994')).toBe(30)
  })

  it.for([
    { label: 'zoneless ISO-8601 timestamp', header: '2099-12-31T00:00:00' },
    { label: 'ISO-8601 timestamp in UTC', header: '2099-12-31T00:00:00Z' },
    { label: 'ISO-8601 calendar date', header: '2099-12-31' },
    { label: 'US-style date', header: 'December 31, 2099' },
    {
      label: 'IMF-fixdate missing its zone',
      header: 'Wed, 21 Oct 2026 07:28:00'
    },
    {
      label: 'IMF-fixdate with an out-of-range day',
      header: 'Wed, 32 Oct 2026 07:28:00 GMT'
    }
  ])(
    'returns undefined for a $label, which is not an HTTP-date',
    async ({ header }) => {
      vi.setSystemTime(new Date('2026-10-21T07:27:30Z'))

      expect(await retryAfterSeconds(header)).toBeUndefined()
    }
  )

  it.for([
    {
      label: 'February 29 outside a leap year',
      header: 'Wed, 29 Feb 2023 07:28:00 GMT'
    },
    {
      label: 'a day past the end of the month',
      header: 'Wed, 31 Nov 2026 07:28:00 GMT'
    },
    { label: 'an hour past midnight', header: 'Wed, 21 Oct 2026 24:00:00 GMT' },
    {
      label: 'a minute past the hour',
      header: 'Wed, 21 Oct 2026 07:60:00 GMT'
    },
    {
      label: 'an out-of-range RFC 850 day',
      header: 'Wednesday, 29-Feb-23 07:28:00 GMT'
    },
    {
      label: 'an out-of-range asctime day',
      header: 'Sun Nov 31 07:28:00 2026'
    },
    {
      label: 'an IMF-fixdate year before 1900',
      header: 'Mon, 06 Nov 1899 08:49:37 GMT'
    },
    {
      label: 'an asctime year before 1900',
      header: 'Mon Nov  6 08:49:37 1899'
    }
  ])('returns undefined for $label', async ({ header }) => {
    vi.setSystemTime(new Date('2026-10-21T07:27:30Z'))

    expect(await retryAfterSeconds(header)).toBeUndefined()
  })

  it('accepts February 29 in a leap year', async () => {
    vi.setSystemTime(new Date('2024-02-29T07:27:30Z'))

    expect(await retryAfterSeconds('Thu, 29 Feb 2024 07:28:00 GMT')).toBe(30)
  })

  it('represents a midnight leap second as the instant after :59', async () => {
    vi.setSystemTime(new Date('2026-10-21T23:59:30Z'))

    expect(await retryAfterSeconds('Wed, 21 Oct 2026 23:59:60 GMT')).toBe(30)
  })

  it('ignores a day-name that disagrees with the date', async () => {
    vi.setSystemTime(new Date('2026-10-21T07:27:30Z'))

    expect(await retryAfterSeconds('Mon, 21 Oct 2026 07:28:00 GMT')).toBe(30)
  })

  it('resolves an RFC 850 two-digit year against the rolling 50-year window', async () => {
    vi.setSystemTime(new Date('2026-10-21T07:27:30Z'))

    const expected = Math.ceil(
      (Date.UTC(2060, 9, 21, 7, 28, 0) - Date.now()) / 1000
    )
    expect(await retryAfterSeconds('Thursday, 21-Oct-60 07:28:00 GMT')).toBe(
      expected
    )
  })

  it('reads an RFC 850 year more than 50 years ahead as the past year it names', async () => {
    vi.setSystemTime(new Date('2026-10-21T07:27:30Z'))

    expect(await retryAfterSeconds('Tuesday, 21-Oct-80 07:28:00 GMT')).toBe(0)
  })

  it('applies the RFC 850 50-year rule to the full timestamp', async () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))

    expect(await retryAfterSeconds('Thursday, 31-Dec-76 00:00:00 GMT')).toBe(0)
  })

  it('rolls an RFC 850 year into the next century when it is within 50 years', async () => {
    vi.setSystemTime(new Date('2076-01-01T00:00:00Z'))

    const expected = Math.ceil(
      (Date.UTC(2100, 11, 31, 0, 0, 0) - Date.now()) / 1000
    )
    expect(await retryAfterSeconds('Friday, 31-Dec-00 00:00:00 GMT')).toBe(
      expected
    )
  })
})
