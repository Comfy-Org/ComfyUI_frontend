import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

import {
  canvasPresenceOf,
  readStarterPromptProfile
} from './starterPromptSignals'

vi.mock(import('@/scripts/api'))

const fetchApi = vi.mocked(api.fetchApi)

function respond(body: unknown, init: { status?: number } = {}) {
  fetchApi.mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { 'Content-Type': 'application/json' }
    })
  )
}

describe('readStarterPromptProfile', () => {
  it('reads the stored survey from the onboarding settings key', async () => {
    respond({ value: { intent: 'video', experience: 'new' } })

    await expect(readStarterPromptProfile()).resolves.toEqual({
      source: 'survey',
      profile: { intent: 'video', experience: 'new' }
    })
    expect(fetchApi).toHaveBeenCalledWith(
      '/settings/onboarding_survey',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('keeps only the fields the selector consumes', async () => {
    respond({
      value: {
        intent: 'workflows',
        experience: 'pro',
        focus: 'pipelines',
        source: 'social',
        sourceOther: 'a referral we must not read'
      }
    })

    await expect(readStarterPromptProfile()).resolves.toEqual({
      source: 'survey',
      profile: { intent: 'workflows', experience: 'pro', focus: 'pipelines' }
    })
  })

  it('drops a focus answer the intent does not support', async () => {
    respond({
      value: { intent: 'images', experience: 'some', focus: 'products' }
    })

    await expect(readStarterPromptProfile()).resolves.toEqual({
      source: 'survey',
      profile: { intent: 'images', experience: 'some' }
    })
  })

  it('maps the survey "other" intent onto exploring', async () => {
    respond({ value: { intent: 'other', intentOther: 'something else' } })

    await expect(readStarterPromptProfile()).resolves.toEqual({
      source: 'survey',
      profile: { intent: 'exploring' }
    })
  })

  it.for([
    { name: 'an unanswered survey', body: { value: null } },
    { name: 'an empty answer set', body: { value: {} } },
    { name: 'a non-object value', body: { value: 'images' } },
    { name: 'an array value', body: { value: ['images'] } },
    { name: 'a payload with no value', body: { onboarding_survey: {} } },
    {
      name: 'answers the selector cannot use',
      body: { value: { source: 'social' } }
    }
  ])('reports $name as unavailable', async ({ body }) => {
    respond(body)

    await expect(readStarterPromptProfile()).resolves.toEqual({
      source: 'unavailable',
      profile: null
    })
  })

  it.for([
    { name: 'a missing setting', status: 404 },
    { name: 'a server error', status: 500 }
  ])('reports $name as unavailable', async ({ status }) => {
    respond(null, { status })

    await expect(readStarterPromptProfile()).resolves.toEqual({
      source: 'unavailable',
      profile: null
    })
  })

  it('reports a network failure as unavailable without throwing', async () => {
    fetchApi.mockRejectedValue(new Error('offline'))

    await expect(readStarterPromptProfile()).resolves.toEqual({
      source: 'unavailable',
      profile: null
    })
  })

  it('reports an unreadable body as unavailable', async () => {
    fetchApi.mockResolvedValue(
      new Response('not json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    await expect(readStarterPromptProfile()).resolves.toEqual({
      source: 'unavailable',
      profile: null
    })
  })

  it('passes the caller abort signal through to the request', async () => {
    respond({ value: { intent: 'images' } })
    const controller = new AbortController()

    await readStarterPromptProfile(controller.signal)

    expect(fetchApi).toHaveBeenCalledWith(
      '/settings/onboarding_survey',
      expect.objectContaining({ signal: controller.signal })
    )
  })
})

describe('canvasPresenceOf', () => {
  it.for([
    { name: 'no graph attached', graph: null },
    { name: 'an undefined graph', graph: undefined },
    { name: 'a graph with no nodes collection', graph: {} },
    { name: 'a graph holding no node', graph: { nodes: [] } }
  ])('reads empty for $name', ({ graph }) => {
    expect(canvasPresenceOf(graph)).toBe('empty')
  })

  it('reads present when the graph holds a node', () => {
    expect(canvasPresenceOf({ nodes: [{ id: 1 }] })).toBe('present')
  })
})
