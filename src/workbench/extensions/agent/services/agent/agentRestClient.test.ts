import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CloudWorkflowEntry } from '../../schemas/agentApiSchema'

const fetchApi = vi.hoisted(() =>
  vi.fn<(route: string, init?: RequestInit) => Promise<Response>>()
)
vi.mock('@/scripts/api', () => ({ api: { fetchApi } }))

import { AgentApiError, createAgentRestClient } from './agentRestClient'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
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

  // Remove SALVAGE-16188-REST-ID once route identifiers are segment-encoded.
  it.fails('percent-encodes a hostile thread id instead of retargeting the path', async () => {
    respond(jsonResponse(202, turnAccepted))
    await makeClient().postMessage('t1/x', { content: 'hi' })

    expect(lastCall().route).toBe('/agent/threads/t1%2Fx/messages')
  })

  it('getMessages GETs the thread messages path', async () => {
    respond(jsonResponse(200, []))
    await makeClient().getMessages('t7')

    const { route, init } = lastCall()
    expect(route).toBe('/agent/threads/t7/messages')
    expect(init.method).toBe('GET')
  })

  it('gets and puts the run-mode preference using the API contract', async () => {
    const preference = { mode: 'auto_limited' as const, credit_limit: 25 }
    respond(jsonResponse(200, preference))

    await expect(createAgentRestClient().getRunMode()).resolves.toEqual(
      preference
    )
    expect(lastCall()).toMatchObject({
      route: '/agent/run-mode',
      init: { method: 'GET' }
    })

    respond(jsonResponse(200, preference))
    await createAgentRestClient().putRunMode(preference)
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

  it('stops at the designed page cap and returns what accumulated', async () => {
    const page = (data: unknown[]) =>
      jsonResponse(200, {
        data,
        pagination: { offset: 0, limit: 100, total: 999, has_more: true }
      })
    for (let i = 0; i < 5; i++) {
      respond(page([{ id: `wf-${i}`, name: `${i}` }]))
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const workflows = await makeClient().listCloudWorkflows()

    expect(fetchApi).toHaveBeenCalledTimes(5)
    expect(workflows).toHaveLength(5)
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      '[agent] cloud workflow index truncated at 5 entries'
    )
    warn.mockRestore()
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

  it('flattens tabs to top-level keys and omits an absent current tab', async () => {
    respond(jsonResponse(202, turnAccepted))
    await makeClient().postMessage('t1', {
      content: 'hi',
      tabs: { open_tabs: [{ workflow_id: 'w1', name: 'One' }] }
    })

    const parsed = JSON.parse(lastCall().init.body as string) as Record<
      string,
      unknown
    >
    expect(parsed.open_tabs).toEqual([{ workflow_id: 'w1', name: 'One' }])
    expect(parsed).not.toHaveProperty('tabs')
    expect(parsed).not.toHaveProperty('current_tab')
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
