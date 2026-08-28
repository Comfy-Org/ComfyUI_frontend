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
    await createAgentRestClient().postMessage('new', { content: 'hi' })

    const { route, init } = lastCall()
    expect(route).toBe('/agent/threads/new/messages')
    expect(init.method).toBe('POST')
  })

  it('percent-encodes a hostile thread id instead of retargeting the path', async () => {
    respond(jsonResponse(202, turnAccepted))
    await createAgentRestClient().postMessage('t1/x', { content: 'hi' })

    expect(lastCall().route).toBe('/agent/threads/t1%2Fx/messages')
  })

  it('getMessages GETs the thread messages path', async () => {
    respond(jsonResponse(200, []))
    await createAgentRestClient().getMessages('t7')

    const { route, init } = lastCall()
    expect(route).toBe('/agent/threads/t7/messages')
    expect(init.method).toBe('GET')
  })

  it('cancelMessage POSTs the cancel path with an empty JSON body', async () => {
    respond(jsonResponse(202, { status: 'cancelling' }))
    await createAgentRestClient().cancelMessage('t7', 'm3')

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

    const workflows = await createAgentRestClient().listCloudWorkflows()

    expect(fetchApi.mock.calls[0][0]).toBe('/workflows?limit=100&offset=0')
    expect(fetchApi.mock.calls[1][0]).toBe('/workflows?limit=100&offset=100')
    expect(workflows.map((w) => w.id)).toEqual(['wf-1', 'wf-2'])
  })

  it('stops at the designed page cap and returns what accumulated', async () => {
    const page = (data: unknown[]) =>
      jsonResponse(200, {
        data,
        pagination: { offset: 0, limit: 100, total: 999, has_more: true }
      })
    for (let i = 0; i < 5; i++) respond(page([{ id: `wf-${i}`, name: `${i}` }]))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const workflows = await createAgentRestClient().listCloudWorkflows()

    expect(fetchApi).toHaveBeenCalledTimes(5)
    expect(workflows).toHaveLength(5)
    warn.mockRestore()
  })
})

describe('postMessage wire body', () => {
  it('uses snake_case workflow_id and includes only the keys provided', async () => {
    respond(jsonResponse(202, turnAccepted))
    await createAgentRestClient().postMessage('t1', {
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

  it('flattens tabs to top-level snake_case keys, omitting an absent current_tab', async () => {
    respond(jsonResponse(202, turnAccepted))
    await createAgentRestClient().postMessage('t1', {
      content: 'hi',
      tabs: { open_tabs: [{ workflow_id: 'w1', name: 'One' }] }
    })

    const parsed = JSON.parse(lastCall().init.body as string) as Record<
      string,
      unknown
    >
    expect(parsed.open_tabs).toEqual([{ workflow_id: 'w1', name: 'One' }])
    expect('tabs' in parsed).toBe(false)
    expect('current_tab' in parsed).toBe(false)

    respond(jsonResponse(202, turnAccepted))
    await createAgentRestClient().postMessage('t1', {
      content: 'hi',
      tabs: { open_tabs: [], current_tab: 'w2' }
    })
    const withCurrent = JSON.parse(lastCall().init.body as string) as Record<
      string,
      unknown
    >
    expect(withCurrent.current_tab).toBe('w2')
  })

  it('omits absent optionals rather than sending them as undefined keys', async () => {
    respond(jsonResponse(202, turnAccepted))
    await createAgentRestClient().postMessage('t1', { content: 'just text' })

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
    await createAgentRestClient().uploadImage(blob, 'x.png')

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

    const result = await createAgentRestClient().postMessage('t1', {
      content: 'hi'
    })

    expect(result.message_id).toBe('m1')
    expect(result.thread_id).toBe('t1')
    expect((result as Record<string, unknown>).workflow_id).toBe('w1')
  })
})

describe('error mapping', () => {
  it('maps a plain-string error body to its message with the status and parsed body', async () => {
    respond(jsonResponse(409, { error: 'turn is not running' }))

    const error = await createAgentRestClient()
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

    const error = await createAgentRestClient()
      .getMessages('t-x')
      .catch((e: unknown) => e)

    expect((error as AgentApiError).message).toBe('access denied')
    expect((error as AgentApiError).status).toBe(403)
  })

  it('surfaces a short text/plain error body when the reason phrase is absent', async () => {
    respond(new Response('gateway boom', { status: 502 }))

    const error = await createAgentRestClient()
      .getMessages('t1')
      .catch((e: unknown) => e)

    const apiError = error as AgentApiError
    expect(apiError.message).toBe('gateway boom')
    expect(apiError.status).toBe(502)
    expect(apiError.body).toBeUndefined()
  })

  it('falls back to HTTP <status> when the body is empty and no reason phrase exists', async () => {
    respond(new Response(null, { status: 502 }))

    const error = await createAgentRestClient()
      .getMessages('t1')
      .catch((e: unknown) => e)

    expect((error as AgentApiError).message).toBe('HTTP 502')
  })

  it('throws zod when a success body violates the response schema (anti-drift)', async () => {
    respond(jsonResponse(200, { wrong: 'shape' }))

    const error = await createAgentRestClient()
      .getMessages('t-1')
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(AgentApiError)
  })
})
