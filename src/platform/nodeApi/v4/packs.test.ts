import { beforeEach, describe, expect, it } from 'vitest'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ServedPack } from '@/platform/nodeApi/shared/versionHost'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'
import { registerTestPack } from '@/platform/nodeApi/v4/__tests__/testPack'

const BASE = 'https://comfy.test/under/a/prefix/extensions/'

const ANCHORS: ServedPack = {
  segment: 'ComfyUI_Anchors',
  id: 'comfyui-anchors',
  version: '1.2.0'
}

describe('registerPack', () => {
  let api: ComfyApi

  beforeEach(() => {
    api = createComfyApi({ getGraph: () => null, extensionsUrl: () => BASE })
  })

  function registered(url: string) {
    return api.comfy.registerPack({ url })
  }

  describe('with the records of a backend that verifies packs', () => {
    beforeEach(() => {
      api.host.providePacks([
        ANCHORS,
        { segment: 'with space', id: 'spaced', version: null }
      ])
    })

    it('gives the id of the pack whose folder the module is in, under the base path', () => {
      const packId = registered(`${BASE}ComfyUI_Anchors/js/main.js`)

      expect(packId).toEqual({ id: 'comfyui-anchors', version: '1.2.0' })
      expect(Object.isFrozen(packId)).toBe(true)
    })

    it('gives every module of a pack the same PackId', () => {
      expect(registered(`${BASE}ComfyUI_Anchors/a.js`)).toBe(
        registered(`${BASE}ComfyUI_Anchors/deep/b.mjs`)
      )
    })

    it('reads the module path without its query or fragment', () => {
      expect(
        registered(`${BASE}ComfyUI_Anchors/main.js?v=3&retry=1#top`).id
      ).toBe('comfyui-anchors')
    })

    it('decodes the folder segment', () => {
      expect(registered(`${BASE}with%20space/main.js`)).toEqual({
        id: 'spaced',
        version: undefined
      })
    })

    it('accepts import.meta itself', () => {
      const meta = Object.assign(Object.create(null), {
        url: `${BASE}ComfyUI_Anchors/main.js`,
        resolve: () => ''
      })

      expect(api.comfy.registerPack(meta).id).toBe('comfyui-anchors')
    })

    it.for([
      { name: 'a folder with no record', url: `${BASE}Unknown/main.js` },
      {
        name: 'a folder named in another case',
        url: `${BASE}comfyui_anchors/main.js`
      }
    ])('refuses $name', ({ url }) => {
      expectRefusal(() => registered(url), 'registerPack')
    })
  })

  describe('modules outside a pack folder', () => {
    beforeEach(() => api.host.providePacks([ANCHORS]))

    it.for([
      {
        name: 'the root extensions folder of a prefixed install',
        url: 'https://comfy.test/extensions/ComfyUI_Anchors/main.js'
      },
      {
        name: 'another origin',
        url: 'https://elsewhere.test/under/a/prefix/extensions/ComfyUI_Anchors/main.js'
      },
      {
        name: 'a file directly in the extensions folder',
        url: `${BASE}main.js`
      },
      { name: 'an empty folder segment', url: `${BASE}/main.js` },
      {
        name: 'a segment that does not decode',
        url: `${BASE}bad%E0%A4%A/main.js`
      },
      { name: 'a relative URL', url: 'ComfyUI_Anchors/main.js' }
    ])('refuses $name', ({ url }) => {
      expectRefusal(() => registered(url), 'registerPack')
    })
  })

  it.for([
    { name: 'nothing', meta: undefined },
    { name: 'null', meta: null },
    { name: 'a URL as text', meta: `${BASE}ComfyUI_Anchors/main.js` },
    { name: 'an object without a url', meta: {} },
    { name: 'a url that is not text', meta: { url: 5 } }
  ])('refuses $name as the module’s meta', ({ meta }) => {
    api.host.providePacks([ANCHORS])

    expectRefusal(
      () => Reflect.apply(api.comfy.registerPack, api.comfy, [meta]),
      'registerPack'
    )
  })

  it('refuses a meta whose url cannot be read', () => {
    api.host.providePacks([ANCHORS])
    const hostile = new Proxy(
      {},
      {
        get() {
          throw new Error('no')
        }
      }
    )

    expectRefusal(
      () => Reflect.apply(api.comfy.registerPack, api.comfy, [hostile]),
      'registerPack'
    )
  })

  describe('with no records, from a backend that does not verify packs', () => {
    beforeEach(() => api.host.providePacks(undefined))

    it('gives a PackId named by the decoded folder as served, with no version', () => {
      expect(registered(`${BASE}My%20Anchors/main.js?v=1`)).toEqual({
        id: 'folder:My Anchors',
        version: undefined
      })
    })

    it('gives every module of the folder the same PackId, and a folder named in another case its own', () => {
      const anchors = registered(`${BASE}Anchors/a.js`)

      expect(registered(`${BASE}Anchors/deep/b.js`)).toBe(anchors)
      expect(registered(`${BASE}anchors/b.js`)).toEqual({
        id: 'folder:anchors',
        version: undefined
      })
    })

    it('takes a folder named like a field a node saves, as its id cannot be one', () => {
      expect(registered(`${BASE}title/main.js`).id).toBe('folder:title')
    })

    it('still refuses a module outside a pack folder', () => {
      expectRefusal(
        () => registered('https://comfy.test/extensions/Anchors/main.js'),
        'registerPack'
      )
    })

    it('gives a PackId define and extend accept', () => {
      const packId = registered(`${BASE}Anchors/main.js`)

      expect(() =>
        api.comfy.defs.define(packId, { type: 'Anchors/Unverified' })
      ).not.toThrow()
      expect(() => api.comfy.defs.extend(packId, 'Any', () => {})).not.toThrow()
    })
  })

  it.for([
    {
      name: 'one id at two folders',
      records: [
        ANCHORS,
        { segment: 'Anchors_Copy', id: ANCHORS.id, version: '0.9.0' }
      ],
      refused: ['ComfyUI_Anchors', 'Anchors_Copy']
    },
    {
      name: 'one folder with two records',
      records: [ANCHORS, { ...ANCHORS, id: 'other-anchors' }],
      refused: ['ComfyUI_Anchors']
    }
  ])(
    'gives no record to a folder of a list with $name, and keeps the rest',
    ({ records, refused }) => {
      api.host.providePacks([
        ...records,
        { segment: 'Steady', id: 'steady', version: null }
      ])

      for (const segment of refused) {
        expectRefusal(
          () => registered(`${BASE}${segment}/main.js`),
          'registerPack'
        )
      }
      expect(registered(`${BASE}Steady/main.js`).id).toBe('steady')
    }
  )

  it.for([
    { name: 'a field a node saves', id: 'properties' },
    { name: 'the saved fields of packs', id: 'extensions' },
    { name: 'a folder entry', id: 'folder:anchors' },
    { name: 'a name the registry refuses', id: '-anchors' }
  ])('refuses a verified id that is $name', ({ id }) => {
    api.host.providePacks([{ segment: 'Clash', id, version: null }])

    expectRefusal(() => registered(`${BASE}Clash/main.js`), 'registerPack')
  })

  it('takes the page’s /extensions/ as the base when the host gives none', () => {
    const plain = createComfyApi({ getGraph: () => null })

    expect(registerTestPack(plain).id).toBe('test-pack')
  })
})

describe('the PackId define and extend take', () => {
  let api: ComfyApi

  beforeEach(() => {
    api = createComfyApi({ getGraph: () => null })
  })

  it.for([
    { name: 'nothing', packId: undefined },
    { name: 'a type name in its place', packId: 'Pack/Type' },
    {
      name: 'a copy of a PackId',
      packId: { id: 'test-pack', version: '1.0.0' }
    }
  ])('refuses $name before anything is registered', ({ packId }) => {
    registerTestPack(api)

    expectRefusal(
      () =>
        Reflect.apply(api.comfy.defs.define, api.comfy.defs, [
          packId,
          { type: 'Pack/Refused' }
        ]),
      'define'
    )
    expectRefusal(
      () =>
        Reflect.apply(api.comfy.defs.extend, api.comfy.defs, [
          packId,
          'Pack/Refused',
          () => {}
        ]),
      'extend'
    )
    expect(api.comfy.defs.has('Pack/Refused')).toBe(false)
  })

  it('refuses a PackId another API issued', () => {
    const other = createComfyApi({ getGraph: () => null })
    const foreign = registerTestPack(other)

    expectRefusal(
      () => api.comfy.defs.define(foreign, { type: 'Pack/Foreign' }),
      'define'
    )
    expectRefusal(() => api.comfy.defs.extend(foreign, 'X', () => {}), 'extend')
  })
})
