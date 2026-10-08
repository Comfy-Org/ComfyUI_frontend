import { assert, describe, expect, it, vi } from 'vitest'

import { legacyMenuCompat } from '@/lib/litegraph/src/contextMenuCompat'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { useExtensionStore } from '@/stores/extensionStore'
import type { ComfyExtension } from '@/types/comfy'

import type { ExtensionLoadFailure } from './extensionService'
import {
  reportExtensionLoadFailures,
  shouldLoadExtension,
  useExtensionService
} from './extensionService'

vi.mock(import('@/platform/telemetry/reportError'))

vi.mock(import('@/extensions/core/index'), () => ({}))

describe('shouldLoadExtension', () => {
  it.for(['/extensions/cloud/rum.js', '/extensions/cloud/sentry.js'])(
    'skips the inlined Cloud extension %s in cloud builds',
    (extension) => {
      expect(shouldLoadExtension(extension, true)).toBe(false)
    }
  )

  it.for(['/extensions/cloud/rum.js', '/extensions/cloud/sentry.js'])(
    'keeps the legacy path %s available outside cloud builds',
    (extension) => {
      expect(shouldLoadExtension(extension, false)).toBe(true)
    }
  )

  it('skips core extensions that load through the core entry point', () => {
    expect(shouldLoadExtension('/extensions/core/foo.js', false)).toBe(false)
  })

  it('loads other extensions', () => {
    expect(shouldLoadExtension('/extensions/comfyui-foo/main.js', true)).toBe(
      true
    )
  })
})

const BROKEN = '/extensions/comfyui-broken/main.js'

describe('extension loading', () => {
  const failureFor = (ext: string): ExtensionLoadFailure => ({
    ext,
    error: new Error(`Cannot find module '${ext}'`)
  })

  describe('reportExtensionLoadFailures', () => {
    it('stays silent when nothing failed', () => {
      reportExtensionLoadFailures([])

      expect(reportError).not.toHaveBeenCalled()
    })

    it('reports a whole load as one typed error naming the failing packs', () => {
      const failures = [failureFor(BROKEN), failureFor('/extensions/b/b.js')]

      reportExtensionLoadFailures(failures)

      expect(reportError).toHaveBeenCalledOnce()
      const [cause, options] = vi.mocked(reportError).mock.calls[0]
      assert(cause instanceof Error)
      expect(cause.message).toBe(
        'Error loading 2 extensions: /extensions/comfyui-broken/main.js, /extensions/b/b.js'
      )
      expect(cause.cause).toBe(failures[0].error)
      expect(options).toMatchObject({
        errorType: 'error_loading_extension',
        surface: 'platform',
        level: 'warning'
      })
      expect(options.tags).toEqual({ failed_extension_count: 2 })
      expect(options.context?.failures).toEqual([
        { ext: BROKEN, message: `Cannot find module '${BROKEN}'` },
        {
          ext: '/extensions/b/b.js',
          message: "Cannot find module '/extensions/b/b.js'"
        }
      ])
    })

    it('elides the tail once past the naming cap', () => {
      const failures = Array.from({ length: 13 }, (_, i) =>
        failureFor(`/extensions/pack-${i}/main.js`)
      )

      reportExtensionLoadFailures(failures)

      const [cause, options] = vi.mocked(reportError).mock.calls[0]
      assert(cause instanceof Error)
      expect(cause.message).toContain('Error loading 13 extensions')
      expect(cause.message).toContain('(+3 more)')
      expect(cause.message).not.toContain('pack-10')
      expect(options.tags).toMatchObject({ failed_extension_count: 13 })
      expect(options.context?.failures).toHaveLength(10)
    })

    it('does not pair its own console line with the report', () => {
      reportExtensionLoadFailures([failureFor(BROKEN)])

      expect(console.error).not.toHaveBeenCalled()
      expect(console.warn).not.toHaveBeenCalled()
    })
  })

  describe('loadExtensions', () => {
    it('reports every failing custom import as one aggregate', async () => {
      vi.spyOn(api, 'getExtensions').mockResolvedValue([
        '/extensions/pack-a/main.js',
        '/extensions/pack-b/main.js'
      ])

      await useExtensionService().loadExtensions()

      expect(reportError).toHaveBeenCalledOnce()
      const [cause, options] = vi.mocked(reportError).mock.calls[0]
      assert(cause instanceof Error)
      expect(cause.message).toBe(
        'Error loading 2 extensions: /extensions/pack-a/main.js, /extensions/pack-b/main.js'
      )
      expect(options.tags).toEqual({ failed_extension_count: 2 })
      expect(console.error).not.toHaveBeenCalled()
    })

    it('stays silent when no custom extensions are listed', async () => {
      vi.spyOn(api, 'getExtensions').mockResolvedValue([])

      await useExtensionService().loadExtensions()

      expect(reportError).not.toHaveBeenCalled()
    })

    it('skips core extensions', async () => {
      vi.spyOn(api, 'getExtensions').mockResolvedValue([
        '/extensions/core/foo.js',
        '/extensions/pack-a/main.js'
      ])

      await useExtensionService().loadExtensions()

      const [cause] = vi.mocked(reportError).mock.calls[0]
      assert(cause instanceof Error)
      expect(cause.message).toBe(
        'Error loading 1 extension: /extensions/pack-a/main.js'
      )
    })

    it('times the core and custom imports as separate subphases', async () => {
      const mark = vi.spyOn(performance, 'mark')
      vi.spyOn(api, 'getExtensions').mockResolvedValue([
        '/extensions/pack-a/main.js'
      ])

      await useExtensionService().loadExtensions()

      expect(mark.mock.calls.map(([name]) => name)).toEqual([
        'bootstrap/extensions-load-core:start',
        'bootstrap/extensions-load-core:end',
        'bootstrap/extensions-load-custom:start',
        'bootstrap/extensions-load-custom:end'
      ])
    })
  })
})

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

  it('keeps one result slot per enabled extension, aligned by index', async () => {
    register(
      { name: 'none-first' },
      { name: 'a', [HOOK]: () => 'a-result' },
      { name: 'none-middle' },
      { name: 'b', [HOOK]: async () => 'b-result' },
      { name: 'none-last' }
    )

    const results = await invoke()

    expect(results).toHaveLength(5)
    expect(results).toEqual([
      undefined,
      'a-result',
      undefined,
      'b-result',
      undefined
    ])
    expect(Array.from(results.keys())).toEqual([0, 1, 2, 3, 4])
  })

  it('skips disabled extensions without leaving a slot', async () => {
    const hook = vi.fn()
    register({ name: 'off', [HOOK]: hook }, { name: 'on', [HOOK]: hook })
    useExtensionStore().loadDisabledExtensionNames(['off'])

    const results = await invoke()

    expect(hook).toHaveBeenCalledOnce()
    expect(results).toHaveLength(1)
  })

  it('calls hooks inherited from the prototype chain', async () => {
    const hook = vi.fn()
    register(Object.create({ [HOOK]: hook }, { name: { value: 'inherited' } }))

    await invoke()

    expect(hook).toHaveBeenCalledOnce()
  })

  it('passes the args plus the app and binds this to the extension', async () => {
    const hook = vi.fn()
    const ext: TestExtension = { name: 'a', [HOOK]: hook }
    register(ext)
    const defs = {}

    await useExtensionService().invokeExtensionsAsync(HOOK, defs)

    expect(hook).toHaveBeenCalledOnce()
    expect(hook.mock.calls[0][0]).toBe(defs)
    expect(hook.mock.contexts[0]).toBe(useExtensionStore().extensions[0])
  })

  it('ignores a non-function property of the same name', async () => {
    const after = vi.fn()
    register(
      { name: 'not-fn', [HOOK]: 'nope' },
      {
        name: 'after',
        [HOOK]: after
      }
    )

    const results = await invoke()

    expect(after).toHaveBeenCalledOnce()
    expect(results).toEqual([undefined, undefined])
    expect(console.error).not.toHaveBeenCalled()
  })

  it('logs a throwing or rejecting hook and still runs the others', async () => {
    const before = vi.fn()
    const after = vi.fn(() => 'ok')
    register(
      { name: 'before', [HOOK]: before },
      {
        name: 'sync-throw',
        [HOOK]: () => {
          throw new Error('sync boom')
        }
      },
      {
        name: 'async-reject',
        [HOOK]: () => Promise.reject(new Error('async'))
      },
      { name: 'after', [HOOK]: after }
    )

    const results = await invoke()

    expect(before).toHaveBeenCalledOnce()
    expect(after).toHaveBeenCalledOnce()
    expect(results).toEqual([undefined, undefined, undefined, 'ok'])
    expect(console.error).toHaveBeenCalledTimes(2)
    expect(vi.mocked(console.error).mock.calls[0][0]).toBe(
      `Error calling extension 'sync-throw' method '${HOOK}'`
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
  })

  it('isolates a Proxy whose has trap throws', async () => {
    const after = vi.fn()
    const proxied = new Proxy(
      { name: 'proxy' },
      {
        has(target, key) {
          if (key === HOOK) throw new Error('has boom')
          return key in target
        }
      }
    )
    register(proxied, { name: 'after', [HOOK]: after })

    const results = await invoke()

    expect(after).toHaveBeenCalledOnce()
    expect(results).toEqual([undefined, undefined])
    expect(console.error).toHaveBeenCalledOnce()
    expect(vi.mocked(console.error).mock.calls[0][0]).toBe(
      `Error calling extension 'proxy' method '${HOOK}'`
    )
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

    const results = await invoke()

    expect(added).not.toHaveBeenCalled()
    expect(results).toHaveLength(1)
  })

  it('creates promise work only for extensions that define the hook', async () => {
    const all = Array.from({ length: 1000 }, (_, i): ComfyExtension => {
      return i % 300 === 0
        ? { name: `ext-${i}`, [HOOK]: noop }
        : { name: `ext-${i}` }
    })
    register(...all)
    const promiseAll = vi.spyOn(Promise, 'all')

    const results = await invoke()

    expect(results).toHaveLength(1000)
    const [pending] = promiseAll.mock.calls[0]
    // ext-0, ext-300, ext-600 and ext-900 define the hook
    expect([...pending]).toHaveLength(4)
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
    })
  })
})
