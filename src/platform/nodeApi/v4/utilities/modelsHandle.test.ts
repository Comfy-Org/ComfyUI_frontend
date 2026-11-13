import { describe, expect, it, vi } from 'vitest'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'

function modelsApi() {
  return createComfyApi({ getGraph: () => null }).comfy.models
}

function answer(response: Response | Error) {
  vi.mocked(fetch).mockImplementation(async () => {
    if (response instanceof Error) throw response
    return response
  })
}

describe('listing models', () => {
  it('lists each model name in a folder once, in the backend order', async () => {
    answer(
      Response.json([
        { name: 'b.safetensors', pathIndex: 0 },
        { name: 'sub/a.safetensors', pathIndex: 0 },
        { name: 'b.safetensors', pathIndex: 1 }
      ])
    )

    const names = await modelsApi().list('loras')

    expect(names).toEqual(['b.safetensors', 'sub/a.safetensors'])
    expect(Object.isFrozen(names)).toBe(true)
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
      '/api/experiment/models/loras'
    )
  })

  it('lists none for a folder the backend does not know', async () => {
    answer(new Response('', { status: 404 }))

    expect(await modelsApi().list('my_pack_models')).toEqual([])
  })

  it.for([
    { name: 'cannot be reached', failure: new TypeError('Failed to fetch') },
    {
      name: 'answers with an error page',
      failure: new Response('<html>', { status: 500 })
    },
    {
      name: 'answers with something other than a list',
      failure: Response.json({ name: 'a' })
    },
    {
      name: 'answers with an entry without a name',
      failure: Response.json([{ name: 'a' }, { pathIndex: 0 }])
    },
    {
      name: 'answers with an entry that is not an object',
      failure: Response.json(['a'])
    }
  ])('resolves undefined when the server $name', async ({ failure }) => {
    answer(failure)

    expect(await modelsApi().list('loras')).toBeUndefined()
  })

  it.for([undefined, '', '.', '..', 'loras/../x', 'loras?x=1', 'loras#a', 3])(
    'refuses %j as a folder, and sends nothing',
    (folder) => {
      const models = modelsApi()

      expect(() => Reflect.apply(models.list, models, [folder])).toThrow(
        expect.objectContaining({
          name: 'TypeError',
          message: expect.stringContaining(
            'models.list needs a model folder name, not '
          )
        })
      )
      expect(fetch).not.toHaveBeenCalled()
    }
  )

  it('accepts a folder name with dots and dashes', async () => {
    answer(Response.json([]))

    expect(await modelsApi().list('vae.approx-v2')).toEqual([])
  })
})
