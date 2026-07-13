import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  addStylesheet,
  clone,
  getStorageValue,
  prop,
  setStorageValue
} from './utils'

interface LinkAttrs {
  href: string
  onerror: (error: Event) => void
  onload: () => void
  parent: HTMLElement
  rel: string
  type: string
}

const mocks = vi.hoisted(() => ({
  api: {
    clientId: null as string | null,
    initialClientId: null as string | null
  },
  $el: vi.fn()
}))

vi.mock('./api', () => ({
  api: mocks.api
}))

vi.mock('./ui', () => ({
  $el: mocks.$el
}))

function lastLinkAttrs() {
  return mocks.$el.mock.calls.at(-1)?.[1] as LinkAttrs
}

describe('scripts utils', () => {
  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    mocks.api.clientId = null
    mocks.api.initialClientId = null
    mocks.$el.mockReset()
    vi.unstubAllGlobals()
  })

  it('clones with structuredClone and falls back to JSON cloning', () => {
    const source = { nested: { value: 1 } }

    expect(clone(source)).toEqual(source)

    vi.stubGlobal(
      'structuredClone',
      vi.fn(() => {
        throw new Error('unsupported')
      })
    )

    const cloned = clone(source)
    cloned.nested.value = 2

    expect(cloned).toEqual({ nested: { value: 2 } })
    expect(source).toEqual({ nested: { value: 1 } })
  })

  it('adds stylesheets from script and relative URLs', async () => {
    const scriptPromise = addStylesheet('/extensions/example.js')
    lastLinkAttrs().onload()

    await expect(scriptPromise).resolves.toBeUndefined()
    expect(lastLinkAttrs()).toMatchObject({
      href: '/extensions/example.css',
      parent: document.head,
      rel: 'stylesheet',
      type: 'text/css'
    })

    const cssPromise = addStylesheet('theme.css', 'https://example.com/base/')
    lastLinkAttrs().onload()

    await expect(cssPromise).resolves.toBeUndefined()
    expect(lastLinkAttrs().href).toBe('https://example.com/base/theme.css')
  })

  it('rejects when stylesheet loading fails', async () => {
    const promise = addStylesheet('missing.css', 'https://example.com/')
    const error = new Event('error')
    lastLinkAttrs().onerror(error)

    await expect(promise).rejects.toBe(error)
  })

  it('defines an observable property with the supplied default', () => {
    const target = {}
    const onChanged = vi.fn()

    expect(prop(target, 'mode', 'initial', onChanged)).toBe('initial')
    Object.assign(target, { mode: 'next' })

    expect((target as { mode: string }).mode).toBe('next')
    expect(onChanged).toHaveBeenCalledWith('next', undefined, target, 'mode')
  })

  it('uses client-scoped storage before local fallback', () => {
    mocks.api.clientId = 'client-1'
    setStorageValue('setting', 'client-value')
    sessionStorage.removeItem('setting:client-1')

    expect(getStorageValue('setting')).toBe('client-value')
    expect(localStorage.getItem('setting')).toBe('client-value')

    sessionStorage.setItem('setting:client-1', 'session-value')

    expect(getStorageValue('setting')).toBe('session-value')
  })

  it('uses initial client id when the current client id is unavailable', () => {
    mocks.api.initialClientId = 'initial-1'
    setStorageValue('setting', 'initial-value')

    expect(sessionStorage.getItem('setting:initial-1')).toBe('initial-value')
    expect(getStorageValue('setting')).toBe('initial-value')
  })
})
