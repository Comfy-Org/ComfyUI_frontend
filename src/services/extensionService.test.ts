import { describe, expect, it, vi } from 'vitest'

import { legacyMenuCompat } from '@/lib/litegraph/src/contextMenuCompat'
import { useExtensionStore } from '@/stores/extensionStore'

import { useExtensionService } from './extensionService'

describe('invokeExtensionsAsync', () => {
  const HOOK = 'addCustomNodeDefs'
  const noop = () => {}

  // Hooks here return arbitrary values, which the real hook types disallow
  type TestExtension = { name: string; [key: string]: unknown }

  function register(...extensions: TestExtension[]) {
    const store = useExtensionStore()
    for (const ext of extensions) store.registerExtension(ext)
  }

  const invoke = () => useExtensionService().invokeExtensionsAsync(HOOK, {})

  it('only calls extensions that define the hook, in registration order', async () => {
    const calls: string[] = []
    register(
      { name: 'a', [HOOK]: () => void calls.push('a') },
      { name: 'none' },
      { name: 'b', [HOOK]: () => void calls.push('b') }
    )

    await invoke()

    expect(calls).toEqual(['a', 'b'])
  })

  it('invokes every hook synchronously, before any await', () => {
    const calls: string[] = []
    register(
      { name: 'sync', [HOOK]: () => void calls.push('sync') },
      { name: 'async', [HOOK]: async () => void calls.push('async') },
      { name: 'sync2', [HOOK]: () => void calls.push('sync2') }
    )

    void invoke()

    expect(calls).toEqual(['sync', 'async', 'sync2'])
  })

  it('starts hooks concurrently rather than sequentially', async () => {
    const events: string[] = []
    let releaseFirst = noop
    register(
      {
        name: 'slow',
        [HOOK]: async () => {
          events.push('slow:start')
          await new Promise<void>((resolve) => (releaseFirst = resolve))
          events.push('slow:end')
        }
      },
      { name: 'fast', [HOOK]: () => void events.push('fast:start') }
    )

    const done = invoke()
    expect(events).toEqual(['slow:start', 'fast:start'])
    releaseFirst()
    await done
    expect(events).toEqual(['slow:start', 'fast:start', 'slow:end'])
  })

  it('resolves with the results of the hooks that ran, in order', async () => {
    const widgets = { CUSTOM: noop }
    register(
      { name: 'none-first' },
      { name: 'sync', [HOOK]: () => widgets },
      { name: 'a', [HOOK]: async () => 'a-result' },
      { name: 'none-last' },
      { name: 'b', [HOOK]: () => Promise.resolve('b-result') }
    )

    const results = await invoke()

    expect(results).toEqual([widgets, 'a-result', 'b-result'])
    expect(results[0]).toBe(widgets)
  })

  it('keeps falsy but defined sync and async return values', async () => {
    register(
      { name: 'zero', [HOOK]: () => 0 },
      { name: 'false', [HOOK]: () => false },
      { name: 'empty', [HOOK]: () => '' },
      { name: 'null', [HOOK]: () => null },
      { name: 'async-zero', [HOOK]: async () => 0 }
    )

    expect(await invoke()).toEqual([0, false, '', null, 0])
  })

  it('awaits thenables that are not native promises', async () => {
    const order: string[] = []
    register({
      name: 'thenable',
      [HOOK]: () => ({
        then: (resolve: (value: string) => void) => {
          setTimeout(() => {
            order.push('thenable')
            resolve('done')
          }, 0)
        }
      })
    })

    const results = await invoke()

    expect(order).toEqual(['thenable'])
    expect(results).toEqual(['done'])
  })

  it('skips disabled extensions', async () => {
    const hook = vi.fn()
    register({ name: 'off', [HOOK]: hook }, { name: 'on', [HOOK]: hook })
    useExtensionStore().loadDisabledExtensionNames(['off'])

    await invoke()

    expect(hook).toHaveBeenCalledOnce()
  })

  it('calls hooks inherited from the prototype chain', async () => {
    const hook = vi.fn()
    register(Object.create({ [HOOK]: hook }, { name: { value: 'inherited' } }))

    await invoke()

    expect(hook).toHaveBeenCalledOnce()
  })

  it('passes the args plus the app and binds this to the extension', async () => {
    const hook = vi.fn()
    register({ name: 'a', [HOOK]: hook })
    const defs = {}

    await useExtensionService().invokeExtensionsAsync(HOOK, defs)

    expect(hook).toHaveBeenCalledOnce()
    expect(hook.mock.calls[0]).toHaveLength(2)
    expect(hook.mock.calls[0][0]).toBe(defs)
    expect(hook.mock.contexts[0]).toBe(useExtensionStore().extensions[0])
  })

  it('silently ignores a non-function property of the same name', async () => {
    const after = vi.fn()
    register(
      { name: 'not-fn', [HOOK]: 'nope' },
      { name: 'after', [HOOK]: after }
    )

    await invoke()

    expect(after).toHaveBeenCalledOnce()
    expect(console.error).not.toHaveBeenCalled()
  })

  it('logs a throwing sync hook and still runs the others', async () => {
    const before = vi.fn()
    const after = vi.fn()
    register(
      { name: 'before', [HOOK]: before },
      {
        name: 'sync-throw',
        [HOOK]: () => {
          throw new Error('sync boom')
        }
      },
      { name: 'after', [HOOK]: after }
    )

    await invoke()

    expect(before).toHaveBeenCalledOnce()
    expect(after).toHaveBeenCalledOnce()
    expect(console.error).toHaveBeenCalledOnce()
    expect(vi.mocked(console.error).mock.calls[0][0]).toBe(
      `Error calling extension 'sync-throw' method '${HOOK}'`
    )
  })

  it('logs a rejecting async hook without failing the others', async () => {
    const after = vi.fn(async () => 'ok')
    register(
      { name: 'async-reject', [HOOK]: () => Promise.reject(new Error('nope')) },
      { name: 'after', [HOOK]: after }
    )

    const results = await invoke()

    expect(after).toHaveBeenCalledOnce()
    expect(results).toEqual([undefined, 'ok'])
    expect(console.error).toHaveBeenCalledOnce()
    expect(vi.mocked(console.error).mock.calls[0][0]).toBe(
      `Error calling extension 'async-reject' method '${HOOK}'`
    )
  })

  it('isolates a throwing getter', async () => {
    const after = vi.fn()
    const getterExt: TestExtension = { name: 'getter' }
    Object.defineProperty(getterExt, HOOK, {
      enumerable: true,
      get() {
        throw new Error('getter boom')
      }
    })
    register(getterExt, { name: 'after', [HOOK]: after })

    await invoke()

    expect(after).toHaveBeenCalledOnce()
    expect(console.error).toHaveBeenCalledOnce()
    expect(vi.mocked(console.error).mock.calls[0][0]).toBe(
      `Error calling extension 'getter' method '${HOOK}'`
    )
  })

  it('isolates a Proxy whose get trap throws', async () => {
    const after = vi.fn()
    const proxied = new Proxy(
      { name: 'proxy' },
      {
        get(target, key) {
          if (key === HOOK) throw new Error('get boom')
          return Reflect.get(target, key)
        }
      }
    )
    register(proxied, { name: 'after', [HOOK]: after })

    await invoke()

    expect(after).toHaveBeenCalledOnce()
    expect(console.error).toHaveBeenCalledOnce()
  })

  it('picks up a hook added by an earlier extension during the same call', async () => {
    const late = vi.fn()
    const lateExt: TestExtension = { name: 'late' }
    register(
      {
        name: 'installer',
        [HOOK]: () => {
          lateExt[HOOK] = late
        }
      },
      lateExt
    )

    await invoke()

    expect(late).toHaveBeenCalledOnce()
  })

  it('works on a snapshot of the enabled extensions', async () => {
    const added = vi.fn()
    register({
      name: 'registrar',
      [HOOK]: () =>
        useExtensionStore().registerExtension({ name: 'added', [HOOK]: added })
    })

    await invoke()

    expect(added).not.toHaveBeenCalled()
  })

  it('does no work for extensions that do not define the hook', async () => {
    const all = Array.from({ length: 1000 }, (_, i): TestExtension => {
      if (i === 0) return { name: `ext-${i}`, [HOOK]: async () => 'async' }
      return i % 300 === 0
        ? { name: `ext-${i}`, [HOOK]: () => 'sync' }
        : { name: `ext-${i}` }
    })
    register(...all)
    const promiseAll = vi.spyOn(Promise, 'all')

    const results = await invoke()

    // ext-0, ext-300, ext-600 and ext-900 define the hook; only ext-0 is async
    expect(results).toEqual(['async', 'sync', 'sync', 'sync'])
    const [pending] = promiseAll.mock.calls[0]
    expect([...pending]).toHaveLength(4)
    expect([...pending].filter((p) => p instanceof Promise)).toHaveLength(1)
  })

  describe('legacy menu compat tracking for setup', () => {
    it('sets the current extension while setup runs and clears it afterwards', async () => {
      const events: string[] = []
      vi.spyOn(legacyMenuCompat, 'setCurrentExtension').mockImplementation(
        (name) => void events.push(`current:${name}`)
      )
      register(
        { name: 'a', setup: () => void events.push('setup:a') },
        { name: 'none' }
      )

      await useExtensionService().invokeExtensionsAsync('setup')

      expect(events).toEqual(['current:a', 'setup:a', 'current:null'])
    })

    it('clears the current extension when setup throws', async () => {
      const spy = vi.spyOn(legacyMenuCompat, 'setCurrentExtension')
      register({
        name: 'bad',
        setup: () => {
          throw new Error('boom')
        }
      })

      await useExtensionService().invokeExtensionsAsync('setup')

      expect(spy.mock.calls).toEqual([['bad'], [null]])
      expect(console.error).toHaveBeenCalledOnce()
    })

    it('clears the current extension when setup rejects, without failing others', async () => {
      const spy = vi.spyOn(legacyMenuCompat, 'setCurrentExtension')
      const after = vi.fn()
      register(
        { name: 'bad', setup: () => Promise.reject(new Error('nope')) },
        { name: 'after', setup: after }
      )

      await useExtensionService().invokeExtensionsAsync('setup')

      expect(after).toHaveBeenCalledOnce()
      expect(spy.mock.calls).toContainEqual([null])
      expect(console.error).toHaveBeenCalledOnce()
    })

    it('passes the app once to setup hooks', async () => {
      const setup = vi.fn()
      register({ name: 'a', setup })

      await useExtensionService().invokeExtensionsAsync('setup')

      expect(setup).toHaveBeenCalledOnce()
      expect(setup.mock.calls[0]).toHaveLength(1)
    })
  })
})
