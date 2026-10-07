import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { useContextKeyStore } from '@/platform/keybindings/contextKeyStore'
import { KeyComboImpl } from '@/platform/keybindings/keyCombo'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import type { Keybinding } from '@/platform/keybindings/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
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

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
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

describe('registerExtension keybindings', () => {
  it('registers a dialog-scoped keybinding', () => {
    useExtensionService().registerExtension({
      name: 'Test.Scoped',
      keybindings: [
        {
          combo: { key: 'z', ctrl: true },
          commandId: 'Test.MaskUndo',
          dialogKey: 'global-mask-editor'
        }
      ]
    })

    expect(
      useKeybindingStore().getKeybindings(
        new KeyComboImpl({ key: 'z', ctrl: true }),
        'global-mask-editor'
      )[0]?.commandId
    ).toBe('Test.MaskUndo')
  })

  it('rejects a malformed keybinding with a toast and registers nothing', () => {
    const toast = vi.spyOn(useToastStore(), 'add')
    const extension: ComfyExtension = {
      name: 'Test.Broken',
      keybindings: [{ combo: { key: 'k', ctrl: true } } as Keybinding]
    }

    useExtensionService().registerExtension(extension)

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.stringContaining('Test.Broken: invalid keybinding')
      })
    )
    expect(
      useKeybindingStore().getKeybindings(
        new KeyComboImpl({ key: 'k', ctrl: true })
      )
    ).toEqual([])
  })

  it('registers context keys under the extension name', () => {
    useExtensionService().registerExtension({
      name: 'Test.Keys',
      contextKeys: ['wasdMode']
    })

    const contextKeys = useContextKeyStore()
    expect(contextKeys.ownerOf('Test.Keys.wasdMode')).toBe('Test.Keys')
    expect(contextKeys.set('Test.Keys.wasdMode', true)).toBe(true)
  })

  it.for(['My Extension', '@scope/pkg', '3d-viewer'])(
    'registers context keys for an extension named "%s"',
    (name) => {
      useExtensionService().registerExtension({
        name,
        contextKeys: ['ready']
      })

      expect(useContextKeyStore().ownerOf(`${name}.ready`)).toBe(name)
    }
  )

  it('rejects contextKeys that are not a list of names', () => {
    const toast = vi.spyOn(useToastStore(), 'add')
    const extension: ComfyExtension = {
      name: 'Test.BadKeys',
      contextKeys: { wasdMode: true } as unknown as string[]
    }

    useExtensionService().registerExtension(extension)

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.stringContaining('Test.BadKeys')
      })
    )
    expect(useContextKeyStore().ownerOf('Test.BadKeys.wasdMode')).toBe(
      undefined
    )
  })

  it('rejects a keybinding whose when clause does not parse', () => {
    const toast = vi.spyOn(useToastStore(), 'add')

    useExtensionService().registerExtension({
      name: 'Test.BadWhen',
      keybindings: [
        { combo: { key: 'w' }, commandId: 'Test.Pan', when: 'a || b' }
      ]
    })

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.stringContaining('Invalid when clause')
      })
    )
    expect(
      useKeybindingStore().getKeybindings(new KeyComboImpl({ key: 'w' }))
    ).toEqual([])
  })
})
