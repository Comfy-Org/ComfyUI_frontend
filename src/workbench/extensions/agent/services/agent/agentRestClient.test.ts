import { beforeEach, describe, expect, it, vi } from 'vitest'

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

  it('getMessages GETs the thread messages path', async () => {
    respond(jsonResponse(200, []))
    await makeClient().getMessages('t7')

    const { route, init } = lastCall()
    expect(route).toBe('/agent/threads/t7/messages')
    expect(init.method).toBe('GET')
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
    const page = (data: unknown[], hasMore: boolean) =>
      jsonResponse(200, {
        data,
        pagination: {
          offset: 0,
          limit: 100,
          total: data.length,
          has_more: hasMore
        }
      })
    respond(page([{ id: 'wf-1', name: 'one' }], true))
    respond(page([{ id: 'wf-2', name: 'two' }], false))

    const workflows = await makeClient().listCloudWorkflows()

    expect(fetchApi.mock.calls[0][0]).toBe('/workflows?limit=100&offset=0')
    expect(fetchApi.mock.calls[1][0]).toBe('/workflows?limit=100&offset=100')
    expect(workflows.map((w) => w.id)).toEqual(['wf-1', 'wf-2'])
  })
})

describe('getDraft query encoding', () => {
  it('encodes a workflow id containing a space', async () => {
    respond(jsonResponse(200, { content: {}, version: 1 }))
    await makeClient().getDraft('my workflow')

    expect(lastCall().route).toBe('/agent/draft?workflow_id=my%20workflow')
  })

  it('encodes a workflow id containing a slash', async () => {
    respond(jsonResponse(200, { content: {}, version: 1 }))
    await makeClient().getDraft('a/b')

    expect(lastCall().route).toBe('/agent/draft?workflow_id=a%2Fb')
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

  it('parses a getDraft 200 snapshot', async () => {
    respond(jsonResponse(200, { content: { nodes: [] }, version: 24 }))

    const result = await makeClient().getDraft('wf-1')

    expect(result.version).toBe(24)
    expect(result.content).toEqual({ nodes: [] })
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
      .getDraft('wf-x')
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
      .getDraft('wf-1')
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(AgentApiError)
  })
})
