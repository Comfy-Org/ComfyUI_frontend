import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AgentApiError, createAgentRestClient } from './agentRestClient'

// A fake fetch that records the last call and returns a canned Response. Tests read
// `calls` to assert URL/method/headers and set `next` to shape the response.
function fakeFetch() {
  const calls: Array<{ url: string; init: RequestInit }> = []
  let next: Response = jsonResponse(200, {})
  const impl = vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url, init: init ?? {} })
    return Promise.resolve(next)
  }) as unknown as typeof fetch
  return {
    impl,
    calls,
    respond(response: Response) {
      next = response
    }
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

// Extract the recorded Authorization header (or undefined) from an init's headers,
// which the client always writes as a plain object.
function authHeader(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string> | undefined)?.Authorization
}

function contentType(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string> | undefined)?.['Content-Type']
}

const TOKEN = 'tok-123'

let fetchMock: ReturnType<typeof fakeFetch>

function makeClient(
  getAuthToken: () => Promise<string | undefined> | string | undefined = () =>
    TOKEN
) {
  return createAgentRestClient({
    baseUrl: 'https://api.test',
    getAuthToken,
    fetchImpl: fetchMock.impl
  })
}

const turnAccepted = {
  message_id: 'm1',
  thread_id: 't1',
  workflow_id: 'w1'
}

beforeEach(() => {
  fetchMock = fakeFetch()
})

describe('agentRestClient url + method + auth', () => {
  it('createThread POSTs /api/agent/threads with an empty body and no workflow_id', async () => {
    fetchMock.respond(jsonResponse(201, { thread_id: 't9' }))
    const client = makeClient()

    const result = await client.createThread()

    const { url, init } = fetchMock.calls[0]
    expect(url).toBe('https://api.test/api/agent/threads')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{}')
    expect(authHeader(init)).toBe(`Bearer ${TOKEN}`)
    expect(result.thread_id).toBe('t9')
  })

  it('createThread includes workflow_id when given', async () => {
    fetchMock.respond(jsonResponse(201, { thread_id: 't9' }))
    await makeClient().createThread('wf-42')

    expect(fetchMock.calls[0].init.body).toBe('{"workflow_id":"wf-42"}')
  })

  it('postMessage targets the literal "new" thread path to open a thread', async () => {
    fetchMock.respond(jsonResponse(202, turnAccepted))
    await makeClient().postMessage('new', { content: 'hi' })

    const { url, init } = fetchMock.calls[0]
    expect(url).toBe('https://api.test/api/agent/threads/new/messages')
    expect(init.method).toBe('POST')
  })

  it('getMessages GETs the thread messages path with the auth header', async () => {
    fetchMock.respond(jsonResponse(200, []))
    await makeClient().getMessages('t7')

    const { url, init } = fetchMock.calls[0]
    expect(url).toBe('https://api.test/api/agent/threads/t7/messages')
    expect(init.method).toBe('GET')
    expect(authHeader(init)).toBe(`Bearer ${TOKEN}`)
  })

  it('cancelMessage POSTs the cancel path with an empty JSON body', async () => {
    fetchMock.respond(jsonResponse(202, { status: 'cancelling' }))
    await makeClient().cancelMessage('t7', 'm3')

    const { url, init } = fetchMock.calls[0]
    expect(url).toBe('https://api.test/api/agent/threads/t7/messages/m3/cancel')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{}')
  })

  it('resolves an async getAuthToken and sets the bearer header', async () => {
    fetchMock.respond(jsonResponse(201, { thread_id: 't9' }))
    const client = makeClient(() => Promise.resolve('async-tok'))

    await client.createThread()

    expect(authHeader(fetchMock.calls[0].init)).toBe('Bearer async-tok')
  })

  it('omits the Authorization header entirely when getAuthToken resolves undefined', async () => {
    fetchMock.respond(jsonResponse(201, { thread_id: 't9' }))
    const client = makeClient(() => undefined)

    await client.createThread()

    const { init } = fetchMock.calls[0]
    expect(authHeader(init)).toBeUndefined()
    expect(Object.keys(init.headers as Record<string, string>)).not.toContain(
      'Authorization'
    )
  })
})

describe('getDraft query encoding', () => {
  it('encodes a workflow id containing a space', async () => {
    fetchMock.respond(jsonResponse(200, { content: {}, version: 1 }))
    await makeClient().getDraft('my workflow')

    expect(fetchMock.calls[0].url).toBe(
      'https://api.test/api/agent/draft?workflow_id=my%20workflow'
    )
  })

  it('encodes a workflow id containing a slash', async () => {
    fetchMock.respond(jsonResponse(200, { content: {}, version: 1 }))
    await makeClient().getDraft('a/b')

    expect(fetchMock.calls[0].url).toBe(
      'https://api.test/api/agent/draft?workflow_id=a%2Fb'
    )
  })
})

describe('postMessage wire body', () => {
  it('uses snake_case workflow_id and includes only the keys provided', async () => {
    fetchMock.respond(jsonResponse(202, turnAccepted))
    await makeClient().postMessage('t1', {
      content: 'build it',
      workflowId: 'wf-9',
      selection: { nodeId: 3 },
      attachments: ['a1']
    })

    const parsed = JSON.parse(fetchMock.calls[0].init.body as string) as Record<
      string,
      unknown
    >
    expect(parsed).toEqual({
      content: 'build it',
      workflow_id: 'wf-9',
      selection: { nodeId: 3 },
      attachments: ['a1']
    })
    expect(contentType(fetchMock.calls[0].init)).toBe('application/json')
  })

  it('omits absent optionals rather than sending them as undefined keys', async () => {
    fetchMock.respond(jsonResponse(202, turnAccepted))
    await makeClient().postMessage('t1', { content: 'just text' })

    const parsed = JSON.parse(fetchMock.calls[0].init.body as string) as Record<
      string,
      unknown
    >
    expect(Object.keys(parsed)).toEqual(['content'])
  })
})

describe('uploadImage multipart', () => {
  it('posts FormData with the blob appended under "image" with the filename, no manual Content-Type', async () => {
    fetchMock.respond(
      jsonResponse(200, { name: 'x.png', subfolder: '', type: 'input' })
    )
    const appendSpy = vi.spyOn(FormData.prototype, 'append')
    const blob = new Blob(['bytes'], { type: 'image/png' })
    await makeClient().uploadImage(blob, 'x.png')

    const { url, init } = fetchMock.calls[0]
    expect(url).toBe('https://api.test/api/upload/image')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    expect(appendSpy).toHaveBeenCalledWith('image', blob, 'x.png')
    expect(contentType(init)).toBeUndefined()
    appendSpy.mockRestore()
  })
})

describe('success response parsing', () => {
  it('parses the postMessage 202 through zAgentTurnAccepted, keeping extra workflow_id', async () => {
    fetchMock.respond(jsonResponse(202, turnAccepted))

    const result = await makeClient().postMessage('t1', { content: 'hi' })

    expect(result.message_id).toBe('m1')
    expect(result.thread_id).toBe('t1')
    // passthrough keeps the additive workflow_id key
    expect((result as Record<string, unknown>).workflow_id).toBe('w1')
  })

  it('parses a getDraft 200 snapshot', async () => {
    fetchMock.respond(
      jsonResponse(200, { content: { nodes: [] }, version: 24 })
    )

    const result = await makeClient().getDraft('wf-1')

    expect(result.version).toBe(24)
    expect(result.content).toEqual({ nodes: [] })
  })
})

describe('error mapping', () => {
  it('maps a plain-string error body to its message with the status and parsed body', async () => {
    fetchMock.respond(jsonResponse(409, { error: 'turn is not running' }))

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
    fetchMock.respond(
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
    fetchMock.respond(
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
    // thread_id is required by zAgentThreadCreated; a wrong shape must throw.
    fetchMock.respond(jsonResponse(201, { wrong: 'shape' }))

    const error = await makeClient()
      .createThread()
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(AgentApiError)
  })
})
