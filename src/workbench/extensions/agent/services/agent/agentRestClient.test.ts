import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CloudWorkflowEntry } from '../../schemas/agentApiSchema'

const fetchApi = vi.hoisted(() =>
  vi.fn<(route: string, init?: RequestInit) => Promise<Response>>()
)
vi.mock<unknown>(import('@/scripts/api'), () => ({ api: { fetchApi } }))

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
    await makeClient().getMessages('t7')

    const { route, init } = lastCall()
    expect(route).toBe('/agent/threads/t7/messages')
    expect(init.method).toBe('GET')
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
    await makeClient().cancelMessage('t7', 'm3')

    const { route, init } = lastCall()
    expect(route).toBe('/agent/threads/t7/messages/m3/cancel')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{}')
  })

  it('answerAsk POSTs the selected option to the encoded ask path', async () => {
    respond(jsonResponse(202, { status: 'answered' }))
    await makeClient().answerAsk('t7', 'turn-1:call/1', ['run'])

    const { route, init } = lastCall()
    expect(route).toBe('/agent/threads/t7/asks/turn-1%3Acall%2F1/answer')
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
    await makeClient().uploadImage(blob, 'x.png')

    const { route, init } = lastCall()
    expect(route).toBe('/upload/image')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
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

  it.for([
    { label: 'absent', headers: undefined },
    {
      label: 'nonnumeric',
      headers: { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' }
    },
    {
      label: 'unsafe integer',
      headers: { 'Retry-After': '9007199254740993' }
    },
    {
      label: 'overflowing number',
      headers: { 'Retry-After': '9'.repeat(400) }
    }
  ])(
    'leaves retryAfterSeconds undefined for an $label Retry-After header',
    async ({ headers }) => {
      const body = {
        error: {
          message: 'Billing status is temporarily unavailable; please retry.',
          type: 'SERVICE_UNAVAILABLE',
          reason: 'funds_unavailable'
        }
      }
      respond(jsonResponse(503, body, headers))

      const error = await makeClient()
        .postMessage('t1', { content: 'try it' })
        .catch((caught: unknown) => caught)

      expect(error).toBeInstanceOf(AgentApiError)
      expect(error).toMatchObject({
        message: body.error.message,
        body,
        retryAfterSeconds: undefined
      })
    }
  )

  it('falls back to statusText and undefined body for a non-JSON error response', async () => {
    respond(
      new Response('gateway boom', { status: 502, statusText: 'Bad Gateway' })
    )

    const error = await makeClient()
      .getMessages('t1')
      .catch((e: unknown) => e)

    const apiError = error as AgentApiError
    expect(apiError.message).toBe('Bad Gateway')
    expect(apiError.status).toBe(502)
    expect(apiError.body).toBeUndefined()
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
