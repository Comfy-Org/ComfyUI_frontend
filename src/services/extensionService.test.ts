import { describe, expect, it, vi } from 'vitest'
import type { WatchHandle } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { legacyMenuCompat } from '@/lib/litegraph/src/contextMenuCompat'
import { useApp } from '@/scripts/appInstance'
import { useExtensionStore } from '@/stores/extensionStore'
import type { ComfyExtension } from '@/types/comfy'

import { useExtensionService } from './extensionService'

vi.mock(import('@/composables/auth/useCurrentUser'))

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

  type HookApp = ReturnType<typeof useApp>

  it.for([
    {
      entrypoint: 'loadGraphData',
      call: (app: HookApp) => app.loadGraphData()
    },
    {
      entrypoint: 'loadApiJson',
      call: (app: HookApp) => app.loadApiJson({}, 'nested.json')
    },
    {
      entrypoint: 'handleFile',
      call: (app: HookApp) => app.handleFile(new File([], 'nested.png'))
    }
  ])(
    'rejects $entrypoint started after an await in a graph-load hook',
    async ({ call }) => {
      let nested: Promise<unknown> | undefined
      register({
        name: 'nested-loader',
        beforeLoadGraph: async (app: HookApp) => {
          await Promise.resolve()
          nested = call(app)
          await nested.catch(() => {})
        }
      })

      await useExtensionService().invokeExtensionsAsync('beforeLoadGraph')

      await expect(nested).rejects.toThrow(
        'A graph-load lifecycle hook cannot start a nested graph load'
      )
    }
  )

  it('lets a retained hook app load once the hook dispatch has finished', async () => {
    let retained: HookApp | undefined
    register({
      name: 'retaining-extension',
      afterLoadGraph: (app: HookApp) => {
        retained = app
      }
    })
    await useExtensionService().invokeExtensionsAsync('afterLoadGraph')
    const handleFile = vi
      .spyOn(useApp(), 'handleFile')
      .mockResolvedValue(undefined)
    const file = new File([], 'later.png')

    await retained?.handleFile(file)

    expect(handleFile).toHaveBeenCalledWith(file)
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

describe('holding new extensions', () => {
  it('keeps extensions registered while holding aside, in order, without calling them', () => {
    const init = vi.fn()
    useExtensionStore().holdNewExtensions()

    useExtensionService().registerExtension({ name: 'a', init })
    useExtensionService().registerExtension({ name: 'b' })

    expect(useExtensionStore().isHoldingExtensions).toBe(true)
    expect(useExtensionStore().isExtensionInstalled('a')).toBe(false)
    expect(
      useExtensionStore()
        .stopHoldingExtensions()
        .map(({ name }) => name)
    ).toEqual(['a', 'b'])
    expect(init).not.toHaveBeenCalled()
  })

  it('hands over what was held so far and goes on holding', () => {
    useExtensionStore().holdNewExtensions()
    useExtensionService().registerExtension({ name: 'first' })

    const taken = useExtensionStore().takeHeldExtensions()
    useExtensionService().registerExtension({ name: 'second' })

    expect(taken.map(({ name }) => name)).toEqual(['first'])
    expect(useExtensionStore().isExtensionInstalled('second')).toBe(false)
    expect(
      useExtensionStore()
        .stopHoldingExtensions()
        .map(({ name }) => name)
    ).toEqual(['second'])
  })

  it('drops a held extension whose disposer runs before holding stops', () => {
    useExtensionStore().holdNewExtensions()
    const dispose = useExtensionService().registerExtension({ name: 'gone' })

    dispose()

    expect(useExtensionStore().stopHoldingExtensions()).toEqual([])
  })

  it('registers as always once holding stops', () => {
    useExtensionStore().holdNewExtensions()
    useExtensionStore().stopHoldingExtensions()

    useExtensionService().registerExtension({ name: 'after' })

    expect(useExtensionStore().isHoldingExtensions).toBe(false)
    expect(useExtensionStore().isExtensionInstalled('after')).toBe(true)
  })

  it('registers an extension on demand while holding goes on', () => {
    useExtensionStore().holdNewExtensions()

    useExtensionService().registerExtensionNow({ name: 'now' })

    expect(useExtensionStore().isExtensionInstalled('now')).toBe(true)
    expect(useExtensionStore().isHoldingExtensions).toBe(true)
  })
})

describe('invokeStartupHook', () => {
  it('runs one startup step on the given extensions only, one after another, with the app', async () => {
    const events: string[] = []
    const a = {
      name: 'a',
      init: async () => {
        await Promise.resolve()
        events.push('a')
      }
    }
    const b = { name: 'b', init: vi.fn(() => void events.push('b')) }
    const other = { name: 'other', init: vi.fn() }
    useExtensionStore().registerExtension(other)

    await useExtensionService().invokeStartupHook([a, b], 'init')

    expect(events).toEqual(['a', 'b'])
    expect(b.init).toHaveBeenCalledWith(useApp())
    expect(other.init).not.toHaveBeenCalled()
  })

  it('skips a disabled extension', async () => {
    const setup = vi.fn()
    useExtensionStore().loadDisabledExtensionNames(['off'])

    await useExtensionService().invokeStartupHook(
      [{ name: 'off', setup }],
      'setup'
    )

    expect(setup).not.toHaveBeenCalled()
  })

  it('returns a throwing step and runs the rest', async () => {
    const error = new Error('boom')
    const after = vi.fn()
    const bad = {
      name: 'bad',
      setup: () => {
        throw error
      }
    }

    const failures = await useExtensionService().invokeStartupHook(
      [bad, { name: 'after', setup: after }],
      'setup'
    )

    expect(after).toHaveBeenCalledOnce()
    expect(failures).toEqual([{ extension: bad, method: 'setup', error }])
  })

  it('returns an extension whose step cannot be read and runs the rest', async () => {
    const error = new Error('getter')
    const after = vi.fn()
    const bad: ComfyExtension = {
      name: 'bad',
      get init(): never {
        throw error
      }
    }

    const failures = await useExtensionService().invokeStartupHook(
      [bad, { name: 'after', init: after }],
      'init'
    )

    expect(after).toHaveBeenCalledOnce()
    expect(failures).toEqual([{ extension: bad, method: 'init', error }])
  })

  it('passes the step its arguments before the app', async () => {
    const addCustomNodeDefs = vi.fn()
    const defs = {}

    await useExtensionService().invokeStartupHook(
      [{ name: 'a', addCustomNodeDefs }],
      'addCustomNodeDefs',
      defs
    )

    expect(addCustomNodeDefs).toHaveBeenCalledWith(defs, useApp())
  })
})

describe('registerExtension auth hooks', () => {
  function createAuthEvents() {
    const listeners = {
      resolved: new Set<(user: { id: string }) => void>(),
      refreshed: new Set<() => void>(),
      logout: new Set<() => void>()
    }
    function subscribe<T>(set: Set<T>, callback: T): WatchHandle {
      set.add(callback)
      const stop = () => void set.delete(callback)
      return Object.assign(stop, { stop, pause: vi.fn(), resume: vi.fn() })
    }
    const currentUser = useCurrentUser()
    vi.mocked(currentUser.onUserResolved).mockImplementation((callback) =>
      subscribe(listeners.resolved, callback)
    )
    vi.mocked(currentUser.onTokenRefreshed).mockImplementation((callback) =>
      subscribe(listeners.refreshed, callback)
    )
    vi.mocked(currentUser.onUserLogout).mockImplementation((callback) =>
      subscribe(listeners.logout, callback)
    )
    return {
      emit() {
        listeners.resolved.forEach((callback) => callback({ id: 'user-1' }))
        listeners.refreshed.forEach((callback) => callback())
        listeners.logout.forEach((callback) => callback())
      }
    }
  }

  it('keeps exactly one of each auth hook after dispose, re-registration and a stale dispose', () => {
    const authEvents = createAuthEvents()
    const extension = {
      name: 'auth-hooks',
      onAuthUserResolved: vi.fn(),
      onAuthTokenRefreshed: vi.fn(),
      onAuthUserLogout: vi.fn()
    }
    const service = useExtensionService()

    const dispose = service.registerExtension(extension)
    dispose()
    service.registerExtension(extension)
    dispose()
    authEvents.emit()

    expect(extension.onAuthUserResolved).toHaveBeenCalledOnce()
    expect(extension.onAuthTokenRefreshed).toHaveBeenCalledOnce()
    expect(extension.onAuthUserLogout).toHaveBeenCalledOnce()
    expect(useExtensionStore().isExtensionInstalled('auth-hooks')).toBe(true)
  })
})
