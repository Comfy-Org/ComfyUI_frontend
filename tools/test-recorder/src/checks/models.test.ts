import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checkModels } from './models'

function objectInfo(names: unknown) {
  return {
    CheckpointLoaderSimple: { input: { required: { ckpt_name: [names] } } }
  }
}

describe('checkModels', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  function stubJson(body: unknown, status = 200) {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' }
        })
      )
    )
  }

  it('passes when the backend lists a checkpoint', async () => {
    stubJson(objectInfo(['v1-5-pruned.safetensors']))
    expect((await checkModels()).ok).toBe(true)
  })

  it('warns when none are installed, since the dialog blocks the canvas', async () => {
    stubJson(objectInfo([]))
    const result = await checkModels()
    expect(result.ok).toBe(false)
    expect(result.optional).toBe(true)
  })

  it('stays quiet when the backend is unreachable, which backend reports', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('ECONNREFUSED')))
    expect((await checkModels()).ok).toBe(true)
  })

  it.for([
    {},
    { CheckpointLoaderSimple: null },
    { CheckpointLoaderSimple: { input: {} } },
    objectInfo('not-an-array'),
    objectInfo([1, 2])
  ])('treats malformed object_info (%j) as no checkpoints', async (body) => {
    stubJson(body)
    expect((await checkModels()).ok).toBe(false)
  })
})
