import { describe, expect, it } from 'vitest'

import {
  WorkflowHttpError,
  bindWorkflowInputs,
  createWorkflowClient,
  workflowFinished
} from './workflow-execution'

const graph = {
  '1': { class_type: 'LoadImage', inputs: { image: 'example.png' } },
  '2': { class_type: 'SaveImage', inputs: { images: ['1', 0] } }
}

const client = (fetcher: typeof fetch) =>
  createWorkflowClient(
    'https://cloud.test',
    () => Promise.resolve('t'),
    fetcher
  )

const replying = (status: number, body: unknown = {}) =>
  (() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
      })
    )) as unknown as typeof fetch

describe('bindWorkflowInputs', () => {
  it('fills an answer in without touching the graph it was given', () => {
    const bound = bindWorkflowInputs(graph, [
      { node: '1', input: 'image', value: 'mine.png' }
    ])

    expect(bound['1'].inputs.image).toBe('mine.png')
    expect(graph['1'].inputs.image).toBe('example.png')
  })

  // A binding that names nothing is a mapping error, and sending the graph
  // anyway would spend a run to find that out.
  it.for([
    ['9', 'image'],
    ['1', 'nothing']
  ] as const)('refuses a binding for %s.%s', ([node, input]) => {
    expect(() =>
      bindWorkflowInputs(graph, [{ node, input, value: 1 }])
    ).toThrow(/unavailable/i)
  })
})

describe('the Cloud client', () => {
  // What went wrong decides what the reader can do next, so each answer that
  // means something different says something different.
  it.for([
    [402, /plan or credits/i],
    [401, /sign in again/i],
    [403, /cannot run this workflow/i],
    [422, /could not accept/i],
    [500, /returned 500/i]
  ] as const)('turns %i into its own words', async ([status, said]) => {
    await expect(
      client(replying(status)).read('/api/jobs/1', new AbortController().signal)
    ).rejects.toThrow(said)
  })

  it('names being out of credits whatever status carries it', async () => {
    await expect(
      client(replying(400, { error: 'PAYMENT_REQUIRED' })).read(
        '/api/jobs/1',
        new AbortController().signal
      )
    ).rejects.toThrow(/insufficient credits/i)
  })

  // Retrying is safe when the request never reached the work, and a job that
  // may already be running is not something to start twice.
  it.for([
    [422, true],
    [500, false]
  ] as const)('says whether %i is safe to retry', async ([status, safe]) => {
    await client(replying(status))
      .read('/api/jobs/1', new AbortController().signal)
      .catch((error: unknown) => {
        expect(error).toBeInstanceOf(WorkflowHttpError)
        expect((error as WorkflowHttpError).retrySafe).toBe(safe)
      })
  })

  it('refuses a path that would leave the origin it was given', async () => {
    await expect(
      client(replying(200)).read(
        'https://elsewhere.test/api/jobs/1',
        new AbortController().signal
      )
    ).rejects.toThrow(/origin/i)
  })

  it('will not hand back a job without the ID to follow it by', async () => {
    await expect(
      client(replying(200, {})).submit(graph, new AbortController().signal)
    ).rejects.toThrow(/job ID/i)
  })
})

describe('workflowFinished', () => {
  it.for([
    ['completed', true],
    ['failed', true],
    ['cancelled', true],
    ['running', false],
    ['pending', false]
  ] as const)('reads %s as settled: %s', ([status, settled]) => {
    expect(
      workflowFinished({ status } as Parameters<typeof workflowFinished>[0])
    ).toBe(settled)
  })
})
