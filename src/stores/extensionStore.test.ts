import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CORE_SETTINGS } from '@/platform/settings/constants/coreSettings'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { extensionPackName, useExtensionStore } from '@/stores/extensionStore'

vi.mock(import('@/scripts/api'))

const DISABLED_NAMES_SETTING = CORE_SETTINGS.find(
  (setting) => setting.id === 'Comfy.Extension.Disabled'
)!

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
        store.loadBootDisabledExtensionNames(['disabled.ext'])
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

    it('serializes a disabled-name save with an agent batch so neither drops the other', async () => {
      const payloads: unknown[] = []
      const acknowledge: Array<() => void> = []
      const respond = (value: unknown) =>
        new Promise<Response>((resolve) => {
          payloads.push(value)
          acknowledge.push(() => resolve(new Response()))
        })
      vi.mocked(api.storeSetting).mockImplementation((_id, value) =>
        respond(value)
      )
      vi.mocked(api.storeSettings).mockImplementation((settings) =>
        respond(settings)
      )
      settingStore.addSetting(DISABLED_NAMES_SETTING)

      const individual = store.setExtensionEnabledStates({
        'Manual.Toolbar': false
      })
      await vi.waitFor(() => expect(acknowledge).toHaveLength(1))
      const batch = store.disableAgentExtensions([
        { name: 'agent-made.standalone' }
      ])

      await vi.advanceTimersByTimeAsync(0)
      expect(payloads).toEqual([['Manual.Toolbar']])

      acknowledge[0]()
      expect(await individual).toEqual({ ok: true, outcome: 'saved' })
      await vi.waitFor(() => expect(acknowledge).toHaveLength(2))

      expect(payloads[1]).toEqual({
        'Comfy.Extension.Disabled': ['Manual.Toolbar', 'agent-made.standalone'],
        'Comfy.Extension.DisabledPacks': []
      })

      acknowledge[1]()
      expect(await batch).toEqual({ ok: true, outcome: 'saved' })
      expect(store.isSavingExtensionPacks).toBe(false)
    })

    it('preserves an agent disable when a later name edit reaches the queue', async () => {
      const payloads: unknown[] = []
      const acknowledge: Array<() => void> = []
      const respond = (value: unknown) =>
        new Promise<Response>((resolve) => {
          payloads.push(value)
          acknowledge.push(() => resolve(new Response()))
        })
      vi.mocked(api.storeSetting).mockImplementation((_id, value) =>
        respond(value)
      )
      vi.mocked(api.storeSettings).mockImplementation((settings) =>
        respond(settings)
      )
      settingStore.addSetting(DISABLED_NAMES_SETTING)

      const batch = store.disableAgentExtensions([
        { name: 'agent-made.standalone' }
      ])
      await vi.waitFor(() => expect(acknowledge).toHaveLength(1))
      const individual = store.setExtensionEnabledStates({
        'Manual.Toolbar': false
      })

      await vi.advanceTimersByTimeAsync(0)
      expect(payloads).toEqual([
        {
          'Comfy.Extension.Disabled': ['agent-made.standalone'],
          'Comfy.Extension.DisabledPacks': []
        }
      ])

      acknowledge[0]()
      expect(await batch).toEqual({ ok: true, outcome: 'saved' })
      await vi.waitFor(() => expect(acknowledge).toHaveLength(2))
      expect(payloads[1]).toEqual(['agent-made.standalone', 'Manual.Toolbar'])

      acknowledge[1]()
      expect(await individual).toEqual({ ok: true, outcome: 'saved' })
    })

    it('leaves the stored names alone when the server refuses the write', async () => {
      settingStore.addSetting(DISABLED_NAMES_SETTING)
      vi.mocked(api.storeSetting).mockResolvedValue(
        new Response(null, { status: 500, statusText: 'Server Error' })
      )

      const result = await store.setExtensionEnabledStates({
        'Manual.Toolbar': false
      })

      expect(result).toMatchObject({ ok: false, reason: 'refused' })
      expect(settingStore.get('Comfy.Extension.Disabled')).toEqual([])
    })

    it('serializes an agent batch behind an individual pack save', async () => {
      const payloads: unknown[] = []
      const acknowledge: Array<() => void> = []
      const respond = (value: unknown) =>
        new Promise<Response>((resolve) => {
          payloads.push(value)
          acknowledge.push(() => resolve(new Response()))
        })
      vi.mocked(api.storeSetting).mockImplementation((_id, value) =>
        respond(value)
      )
      vi.mocked(api.storeSettings).mockImplementation((settings) =>
        respond(settings)
      )
      settingStore.addSetting(DISABLED_NAMES_SETTING)
      store.loadExtensionPackPaths(['/extensions/cushions/'], [])

      const individual = store.setExtensionPackEnabled('/extensions/a/', false)
      await vi.waitFor(() => expect(acknowledge).toHaveLength(1))
      const batch = store.disableAgentExtensions([
        { name: 'agent.cushions.toolbar' }
      ])

      expect(payloads).toHaveLength(1)
      acknowledge[0]()
      expect(await individual).toEqual({ ok: true, outcome: 'saved' })
      await vi.waitFor(() => expect(acknowledge).toHaveLength(2))

      expect(payloads[1]).toEqual({
        'Comfy.Extension.Disabled': [],
        'Comfy.Extension.DisabledPacks': [
          '/extensions/a/',
          '/extensions/cushions/'
        ]
      })

      acknowledge[1]()
      expect(await batch).toEqual({ ok: true, outcome: 'saved' })
      expect(store.isSavingExtensionPacks).toBe(false)
    })

    it('counts an agent batch as a pending pack save until it settles', async () => {
      let acknowledge = () => {}
      vi.mocked(api.storeSettings).mockImplementation(
        () =>
          new Promise<Response>((resolve) => {
            acknowledge = () => resolve(new Response())
          })
      )
      settingStore.addSetting(DISABLED_NAMES_SETTING)
      store.loadExtensionPackPaths(['/extensions/cushions/'], [])

      const batch = store.disableAgentExtensions([
        { name: 'agent.cushions.toolbar' }
      ])

      expect(store.isSavingExtensionPacks).toBe(true)
      await vi.waitFor(() =>
        expect(store.isExtensionPackEnabled('/extensions/cushions/')).toBe(
          false
        )
      )
      expect(store.isSavingExtensionPacks).toBe(true)

      acknowledge()
      await batch
      expect(store.isSavingExtensionPacks).toBe(false)
    })
  })

  describe('agent provenance', () => {
    it.for([
      ['agent.cushions.toolbar', '/extensions/cushions/'],
      ['agent.my pack.toolbar', '/extensions/my%20pack/'],
      ['agent.missing.toolbar', undefined],
      ['manual.cushions.toolbar', undefined]
    ] as const)('maps %s to %s', ([name, expected]) => {
      const store = useExtensionStore()
      store.loadExtensionPackPaths(
        [
          '/extensions/manual/',
          '/extensions/cushions/',
          '/extensions/my%20pack/'
        ],
        []
      )

      expect(store.getAgentExtensionPackPath({ name })).toBe(expected)
    })

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
    })
  })

  describe('isExtensionEnabled / loadBootDisabledExtensionNames', () => {
    it('all extensions are enabled by default', () => {
      const store = useExtensionStore()
      store.registerExtension({ name: 'fresh' })
      expect(store.isExtensionEnabled('fresh')).toBe(true)
    })

    it('disables extensions from provided list', () => {
      const store = useExtensionStore()
      store.loadBootDisabledExtensionNames(['off.ext'])
      store.registerExtension({ name: 'off.ext' })
      expect(store.isExtensionEnabled('off.ext')).toBe(false)
    })

    it('always disables hardcoded extensions', () => {
      const store = useExtensionStore()
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
      store.loadBootDisabledExtensionNames(['ext.off'])
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
      useSettingStore().$patch({
        settingValues: {
          'Comfy.Extension.Disabled': ['ghost.ext', 'installed.ext']
        }
      })
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
