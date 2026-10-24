import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { extensionPackName, useExtensionStore } from '@/stores/extensionStore'

vi.mock(import('@/scripts/api'))

describe('extensionStore', () => {
  describe('registerExtension', () => {
    it('registers an extension by name', () => {
      const store = useExtensionStore()
      store.registerExtension({ name: 'test.ext' })
      expect(store.isExtensionInstalled('test.ext')).toBe(true)
    })

    it('throws for extension without name', () => {
      const store = useExtensionStore()
      expect(() => store.registerExtension({ name: '' })).toThrow(
        "Extensions must have a 'name' property."
      )
    })

    it('throws for duplicate registration', () => {
      const store = useExtensionStore()
      store.registerExtension({ name: 'dup' })
      expect(() => store.registerExtension({ name: 'dup' })).toThrow(
        "Extension named 'dup' already registered."
      )
    })

    it('warns when registering a disabled extension but still installs it', () => {
      const store = useExtensionStore()
      try {
        store.loadDisabledExtensionNames(['disabled.ext'])
        store.registerExtension({ name: 'disabled.ext' })
        expect(console.warn).toHaveBeenCalledWith(
          'Extension disabled.ext is disabled.'
        )
        expect(store.isExtensionInstalled('disabled.ext')).toBe(true)
        expect(store.isExtensionEnabled('disabled.ext')).toBe(false)
      } finally {
        vi.mocked(console.warn).mockRestore()
      }
    })
  })

  describe('isExtensionInstalled', () => {
    it('returns false for uninstalled extension', () => {
      const store = useExtensionStore()
      expect(store.isExtensionInstalled('missing')).toBe(false)
    })
  })

  describe('extension packs', () => {
    it('deduplicates discovered packs and keeps the boot-time disabled set', () => {
      const store = useExtensionStore()
      store.loadExtensionPackPaths(
        ['/extensions/a/', '/extensions/a/', '/extensions/b/'],
        ['/extensions/b/', '/extensions/missing/']
      )

      expect(store.extensionPackPaths).toEqual([
        '/extensions/a/',
        '/extensions/b/'
      ])
      expect(store.wasExtensionPackEnabledAtBoot('/extensions/a/')).toBe(true)
      expect(store.wasExtensionPackEnabledAtBoot('/extensions/b/')).toBe(false)
    })

    it.for([
      { path: '/extensions/plain/', name: 'plain' },
      { path: '/extensions/with%20space/', name: 'with space' },
      { path: '/extensions/100%/', name: '100%' },
      { path: '', name: '' }
    ])(
      'falls back to the raw segment, naming the pack at $path "$name"',
      ({ path, name }) => {
        expect(extensionPackName(path)).toBe(name)
      }
    )
  })

  describe('setExtensionPackEnabled', () => {
    let store: ReturnType<typeof useExtensionStore>
    let settingStore: ReturnType<typeof useSettingStore>

    beforeEach(() => {
      store = useExtensionStore()
      settingStore = useSettingStore()
      settingStore.addSetting({
        id: 'Comfy.Extension.DisabledPacks',
        name: 'Disabled extension packs',
        type: 'hidden',
        defaultValue: [] as string[]
      })
      vi.mocked(api.storeSetting).mockResolvedValue(new Response())
    })

    it('adds and removes exactly the toggled path, preserving the rest', async () => {
      await settingStore.set('Comfy.Extension.DisabledPacks', [
        '/extensions/missing/'
      ])

      await store.setExtensionPackEnabled('/extensions/a/', false)
      expect(settingStore.get('Comfy.Extension.DisabledPacks')).toEqual([
        '/extensions/missing/',
        '/extensions/a/'
      ])

      await store.setExtensionPackEnabled('/extensions/a/', true)
      expect(settingStore.get('Comfy.Extension.DisabledPacks')).toEqual([
        '/extensions/missing/'
      ])
    })

    it('issues one save at a time so two cannot be acknowledged out of order', async () => {
      const payloads: unknown[] = []
      const acknowledge: Array<() => void> = []
      vi.mocked(api.storeSetting).mockImplementation(
        (_id, value) =>
          new Promise<Response>((resolve) => {
            payloads.push(value)
            acknowledge.push(() => resolve(new Response()))
          })
      )

      const first = store.setExtensionPackEnabled('/extensions/a/', false)
      const second = store.setExtensionPackEnabled('/extensions/b/', false)
      await vi.waitFor(() => expect(acknowledge).toHaveLength(1))

      expect(payloads).toEqual([['/extensions/a/']])
      expect(store.isSavingExtensionPacks).toBe(true)

      acknowledge[0]()
      await first
      await vi.waitFor(() => expect(acknowledge).toHaveLength(2))

      expect(payloads[1]).toEqual(['/extensions/a/', '/extensions/b/'])

      acknowledge[1]()
      await second

      expect(store.isSavingExtensionPacks).toBe(false)
      expect(settingStore.get('Comfy.Extension.DisabledPacks')).toEqual([
        '/extensions/a/',
        '/extensions/b/'
      ])
    })

    it('reports the save as pending from the click until it is acknowledged', async () => {
      let acknowledge = () => {}
      let requested = false
      vi.mocked(api.storeSetting).mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            requested = true
            acknowledge = () => resolve(new Response())
          })
      )

      const save = store.setExtensionPackEnabled('/extensions/a/', false)

      expect(store.isSavingExtensionPacks).toBe(true)
      await vi.waitFor(() => expect(requested).toBe(true))
      expect(store.isSavingExtensionPacks).toBe(true)

      acknowledge()
      await save

      expect(store.isSavingExtensionPacks).toBe(false)
    })

    it('leaves the pack enabled when the server refuses the write', async () => {
      vi.mocked(api.storeSetting).mockResolvedValue(
        new Response(null, { status: 500, statusText: 'Server Error' })
      )

      const result = await store.setExtensionPackEnabled(
        '/extensions/a/',
        false
      )

      expect(result).toMatchObject({ ok: false, reason: 'refused' })
      expect(settingStore.get('Comfy.Extension.DisabledPacks')).toEqual([])
      expect(store.isSavingExtensionPacks).toBe(false)
    })

    it('still runs a queued save after the one before it fails', async () => {
      vi.mocked(api.storeSetting).mockRejectedValueOnce(new Error('offline'))

      const first = store.setExtensionPackEnabled('/extensions/a/', false)
      const second = store.setExtensionPackEnabled('/extensions/b/', false)

      expect(await first).toMatchObject({ ok: false, reason: 'unreachable' })
      expect(await second).toEqual({ ok: true, outcome: 'saved' })

      expect(settingStore.get('Comfy.Extension.DisabledPacks')).toEqual([
        '/extensions/b/'
      ])
    })

    it('maps agent-prefixed extensions to their discovered pack', () => {
      const store = useExtensionStore()
      store.loadExtensionPackPaths(['/extensions/cushions/'], [])
      const extension = { name: 'agent.cushions.toolbar' }

      expect(store.isAgentCreatedExtension(extension)).toBe(true)
      expect(store.getAgentExtensionPackPath(extension)).toBe(
        '/extensions/cushions/'
      )
    })
  })

  describe('agent provenance', () => {
    it('recognizes explicit provenance without requiring the name prefix', () => {
      const store = useExtensionStore()
      store.registerExtension({
        name: 'custom.toolbar',
        provenance: { createdBy: 'comfy-agent' }
      })
      store.registerExtension({ name: 'custom.manual' })

      expect(store.agentExtensions.map((extension) => extension.name)).toEqual([
        'custom.toolbar'
      ])
      expect(store.hasAgentExtensions).toBe(true)
    })
  })

  describe('isExtensionEnabled / loadDisabledExtensionNames', () => {
    it('all extensions are enabled by default', () => {
      const store = useExtensionStore()
      store.registerExtension({ name: 'fresh' })
      expect(store.isExtensionEnabled('fresh')).toBe(true)
    })

    it('disables extensions from provided list', () => {
      const store = useExtensionStore()
      store.loadDisabledExtensionNames(['off.ext'])
      store.registerExtension({ name: 'off.ext' })
      expect(store.isExtensionEnabled('off.ext')).toBe(false)
    })

    it('always disables hardcoded extensions', () => {
      const store = useExtensionStore()
      store.loadDisabledExtensionNames([])
      store.registerExtension({ name: 'pysssss.Locking' })
      store.registerExtension({ name: 'regular.ext' })

      expect(store.isExtensionEnabled('pysssss.Locking')).toBe(false)
      expect(store.isExtensionEnabled('pysssss.SnapToGrid')).toBe(false)
      expect(store.isExtensionEnabled('pysssss.FaviconStatus')).toBe(false)
      expect(store.isExtensionEnabled('KJNodes.browserstatus')).toBe(false)
      expect(store.isExtensionEnabled('regular.ext')).toBe(true)
    })
  })

  describe('enabledExtensions', () => {
    it('filters out disabled extensions', () => {
      const store = useExtensionStore()
      store.loadDisabledExtensionNames(['ext.off'])
      store.registerExtension({ name: 'ext.on' })
      store.registerExtension({ name: 'ext.off' })

      const enabled = store.enabledExtensions
      expect(enabled).toHaveLength(1)
      expect(enabled[0].name).toBe('ext.on')
    })
  })

  describe('isExtensionReadOnly', () => {
    it('returns true for always-disabled extensions', () => {
      const store = useExtensionStore()
      expect(store.isExtensionReadOnly('pysssss.Locking')).toBe(true)
    })

    it('returns false for normal extensions', () => {
      const store = useExtensionStore()
      expect(store.isExtensionReadOnly('some.custom.ext')).toBe(false)
    })
  })

  describe('inactiveDisabledExtensionNames', () => {
    it('returns disabled names not currently installed', () => {
      const store = useExtensionStore()
      store.loadDisabledExtensionNames(['ghost.ext', 'installed.ext'])
      store.registerExtension({ name: 'installed.ext' })

      expect(store.inactiveDisabledExtensionNames).toContain('ghost.ext')
      expect(store.inactiveDisabledExtensionNames).not.toContain(
        'installed.ext'
      )
    })
  })

  describe('core extensions', () => {
    it('captures current extensions as core', () => {
      const store = useExtensionStore()
      store.registerExtension({ name: 'core.a' })
      store.registerExtension({ name: 'core.b' })
      store.captureCoreExtensions()

      expect(store.isCoreExtension('core.a')).toBe(true)
      expect(store.isCoreExtension('core.b')).toBe(true)
    })

    it('identifies third-party extensions registered after capture', () => {
      const store = useExtensionStore()
      store.registerExtension({ name: 'core.x' })
      store.captureCoreExtensions()

      expect(store.hasThirdPartyExtensions).toBe(false)

      store.registerExtension({ name: 'third.party' })
      expect(store.hasThirdPartyExtensions).toBe(true)
    })

    it('returns false for isCoreExtension before capture', () => {
      const store = useExtensionStore()
      store.registerExtension({ name: 'ext.pre' })
      expect(store.isCoreExtension('ext.pre')).toBe(false)
    })
  })
})
