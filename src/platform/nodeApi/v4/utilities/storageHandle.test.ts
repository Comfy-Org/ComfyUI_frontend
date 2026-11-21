import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'

function storageApi() {
  return createComfyApi({ getGraph: () => null }).comfy.storage
}

function answer(response: Response | Error) {
  vi.mocked(fetch).mockImplementation(async () => {
    if (response instanceof Error) throw response
    return response
  })
}

function requests() {
  return vi
    .mocked(fetch)
    .mock.calls.map(([input, init]) => [
      init?.method ?? 'GET',
      new URL(String(input), 'http://host').pathname +
        new URL(String(input), 'http://host').search,
      init?.body
    ])
}

beforeEach(() => {
  answer(new Response('stored text'))
})

describe('reading stored text', () => {
  it('reads the text under a name from the user data', async () => {
    const read = await storageApi().get('MyPack/notes.json')

    expect(read).toEqual({ ok: true, text: 'stored text' })
    expect(Object.isFrozen(read)).toBe(true)
    expect(requests()).toEqual([
      ['GET', '/api/userdata/MyPack%2Fnotes.json', undefined]
    ])
  })

  it('reads nothing when nothing is stored', async () => {
    answer(new Response('', { status: 404 }))

    expect(await storageApi().get('MyPack/notes.json')).toEqual({
      ok: true,
      text: undefined
    })
  })

  it.for([
    { name: 'refuses the read', failure: new Response('', { status: 500 }) },
    { name: 'cannot be reached', failure: new TypeError('Failed to fetch') }
  ])('says so when the server $name', async ({ failure }) => {
    answer(failure)

    expect(await storageApi().get('MyPack/notes.json')).toEqual({ ok: false })
  })
})

describe('storing text', () => {
  it('stores the text as written, replacing what was there', async () => {
    answer(new Response('{}'))

    expect(await storageApi().set('MyPack/notes.json', '{"a":1}')).toBe(true)
    expect(requests()).toEqual([
      [
        'POST',
        '/api/userdata/MyPack%2Fnotes.json?overwrite=true&full_info=false',
        '{"a":1}'
      ]
    ])
  })

  it.for([
    { name: 'refuses it', failure: new Response('', { status: 403 }) },
    { name: 'cannot be reached', failure: new TypeError('Failed to fetch') }
  ])('resolves false when the server $name', async ({ failure }) => {
    answer(failure)

    expect(await storageApi().set('MyPack/notes.json', 'x')).toBe(false)
  })

  it.for([undefined, 5, { text: 'x' }])(
    'refuses %j as the text, and sends nothing',
    (text) => {
      const storage = storageApi()

      expect(() =>
        Reflect.apply(storage.set, storage, ['MyPack/a.json', text])
      ).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('storage.set needs text, not ')
        })
      )
      expect(fetch).not.toHaveBeenCalled()
    }
  )
})

describe('removing stored text', () => {
  it('removes the text under a name', async () => {
    expect(await storageApi().remove('MyPack/notes.json')).toBe(true)
    expect(requests()).toEqual([
      ['DELETE', '/api/userdata/MyPack%2Fnotes.json', undefined]
    ])
  })

  it('succeeds when nothing was stored', async () => {
    answer(new Response('', { status: 404 }))

    expect(await storageApi().remove('MyPack/notes.json')).toBe(true)
  })

  it.for([
    { name: 'refuses it', failure: new Response('', { status: 500 }) },
    { name: 'cannot be reached', failure: new TypeError('Failed to fetch') }
  ])('resolves false when the server $name', async ({ failure }) => {
    answer(failure)

    expect(await storageApi().remove('MyPack/notes.json')).toBe(false)
  })
})

describe('listing stored names', () => {
  it('lists every name under a folder as get takes it', async () => {
    answer(Response.json([{ path: 'a.json' }, { path: 'sub/b.json' }]))

    const names = await storageApi().list('MyPack/presets')

    expect(names).toEqual([
      'MyPack/presets/a.json',
      'MyPack/presets/sub/b.json'
    ])
    expect(Object.isFrozen(names)).toBe(true)
    expect(requests()).toEqual([
      [
        'GET',
        '/api/userdata?dir=MyPack%2Fpresets&recurse=true&split=false&full_info=true',
        undefined
      ]
    ])
  })

  it('lists nothing for a folder that does not exist', async () => {
    answer(new Response('', { status: 404 }))

    expect(await storageApi().list('MyPack/presets')).toEqual([])
  })

  it.for([
    { name: 'refuses the listing', failure: new Response('', { status: 500 }) },
    { name: 'cannot be reached', failure: new TypeError('Failed to fetch') },
    {
      name: 'answers with something other than a list',
      failure: Response.json({ path: 'a' })
    },
    {
      name: 'answers with an entry that has no path',
      failure: Response.json([{ path: 'a' }, { name: 'b' }])
    },
    {
      name: 'answers with an entry that is not an object',
      failure: Response.json(['a'])
    }
  ])('resolves undefined when the server $name', async ({ failure }) => {
    answer(failure)

    expect(await storageApi().list('MyPack/presets')).toBeUndefined()
  })
})

describe('storage names', () => {
  it.for([
    { member: 'get', args: [] },
    { member: 'set', args: ['text'] },
    { member: 'remove', args: [] },
    { member: 'list', args: [] }
  ] as const)(
    '$member refuses a name that leaves the user data',
    ({ member, args }) => {
      const storage = storageApi()

      for (const name of [
        undefined,
        '',
        '/MyPack/a.json',
        'MyPack/../comfy.settings.json',
        'MyPack/./a.json',
        'MyPack//a.json',
        'MyPack/a.json/',
        'MyPack\\a.json',
        'MyPack/a\0.json',
        7
      ]) {
        expect(() =>
          Reflect.apply(storage[member], storage, [name, ...args])
        ).toThrow(
          expect.objectContaining({
            name: 'TypeError',
            message: expect.stringContaining(
              `storage.${member} needs a relative path such as MyPack/data.json, not `
            )
          })
        )
      }
      expect(fetch).not.toHaveBeenCalled()
    }
  )
})
