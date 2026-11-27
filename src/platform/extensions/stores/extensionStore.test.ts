import { describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { useExtensionStore } from '@/platform/extensions/stores/extensionStore'
import { useWidgetAugmentations } from '@/platform/extensions/useWidgetAugmentations'
import { reportError } from '@comfyorg/telemetry/reportError'
import type { ComfyExtension } from '@/types/comfy'

vi.mock(import('@comfyorg/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

describe('extensionStore', () => {
  describe('registerExtension', () => {
    it('registers an extension by name', () => {
      const store = useExtensionStore()
      store.registerExtension({ name: 'test.ext' })
      expect(store.isExtensionInstalled('test.ext')).toBe(true)
    })

    it('registers immutable extensions with valid augmentations', () => {
      const store = useExtensionStore()
      const extension = Object.freeze({
        name: 'test.immutable',
        widgetAugmentations: [
          {
            id: 'hint',
            kind: 'hint',
            target: { nodeType: 'TestNode', widgetName: 'prompt' },
            text: () => 'Prompt hint'
          }
        ]
      } satisfies ComfyExtension)

      store.registerExtension(extension)

      expect(store.extensions[0]).toBe(extension)
    })

    it('does not restore removed augmentations when registering the same object again', () => {
      const store = useExtensionStore()
      const target = { nodeType: 'TestNode', widgetName: 'prompt' }
      const extension: ComfyExtension = {
        name: 'test.reregister',
        widgetAugmentations: [
          { id: 'hint', kind: 'hint', target, text: () => 'Prompt hint' }
        ]
      }
      const { contributions } = useWidgetAugmentations(() => target)
      store.registerExtension(extension)
      expect(contributions.value.map((item) => item.key)).toEqual([
        'test.reregister:hint'
      ])

      store.unregisterExtension(extension.name)
      delete extension.widgetAugmentations
      store.registerExtension(extension)

      expect(contributions.value).toEqual([])
    })

    it('retains prototype hooks when excluding malformed augmentations', () => {
      class Extension implements ComfyExtension {
        [key: string]: unknown
        name = 'test.prototype'
        widgetAugmentations = []
        initialized = false

        setup() {
          this.initialized = true
        }
      }
      const store = useExtensionStore()
      const extension = new Extension()
      Reflect.set(extension, 'widgetAugmentations', [null])

      store.registerExtension(extension)

      expect(store.extensions[0]).toBe(extension)
      expect(store.extensions[0].setup).toBe(extension.setup)
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

    it.for([
      null,
      { id: 'missing-target', kind: 'hint', text: () => 'broken' },
      { id: 'missing-callback', kind: 'hint', target: {} }
    ])('isolates malformed JavaScript augmentations: %j', (invalid) => {
      const store = useExtensionStore()
      const setup = vi.fn()
      const extension: ComfyExtension = { name: 'test.invalid', setup }
      const valid = {
        id: 'valid',
        kind: 'hint',
        target: { nodeType: 'TestNode', widgetName: 'prompt' },
        text: (value: string) => `Length: ${value.length}`
      }
      Reflect.set(extension, 'widgetAugmentations', [invalid, valid])
      Object.freeze(extension)

      store.registerExtension(extension)
      store.registerExtension({ name: 'test.neighbor' })

      expect(
        store.getWidgetAugmentations(store.extensions[0]).map((item) => item.id)
      ).toEqual(['valid'])
      expect(extension.widgetAugmentations).toEqual([invalid, valid])
      expect(store.extensions[0].setup).toBe(setup)
      expect(store.isExtensionInstalled('test.neighbor')).toBe(true)
      expect(reportError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          errorType: 'error_registering_widget_augmentation',
          context: { extension: 'test.invalid' }
        })
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

  describe('agent provenance', () => {
    it('attributes explicit provenance or an agent.<pack>. prefix, and nothing else', () => {
      const store = useExtensionStore()
      store.registerExtension({
        name: 'custom.toolbar',
        provenance: { createdBy: 'comfy-agent' }
      })
      store.registerExtension({ name: 'agent.cushions.toolbar' })
      store.registerExtension({ name: 'agentic.toolbar' })
      store.registerExtension({ name: 'agent.tools' })
      store.registerExtension({ name: 'agent..toolbar' })
      store.registerExtension({ name: 'custom.manual' })

      expect(store.agentExtensions.map((extension) => extension.name)).toEqual([
        'custom.toolbar',
        'agent.cushions.toolbar'
      ])
    })
  })

  describe('extension paths', () => {
    it('deduplicates discovered paths and snapshots disabled paths at boot', () => {
      const store = useExtensionStore()
      store.loadExtensionPaths(
        ['/extensions/a/', '/extensions/a/', '/extensions/b/'],
        ['/extensions/b/', '/extensions/missing/']
      )

      expect(store.extensionPaths).toEqual(['/extensions/a/', '/extensions/b/'])
      expect(store.isExtensionPathEnabledAtBoot('/extensions/a/')).toBe(true)
      expect(store.isExtensionPathEnabledAtBoot('/extensions/b/')).toBe(false)
    })

    it('maps each path to its current setting and lists those that differ from boot', () => {
      const settingStore = useSettingStore()
      const store = useExtensionStore()
      store.loadExtensionPaths(
        ['/extensions/a/', '/extensions/b/', '/extensions/c/'],
        ['/extensions/b/']
      )
      settingStore.settingValues['Comfy.Extension.DisabledPacks'] = [
        '/extensions/a/',
        '/extensions/b/'
      ]

      expect(store.enabledByPath).toEqual({
        '/extensions/a/': false,
        '/extensions/b/': false,
        '/extensions/c/': true
      })
      expect(store.changedExtensionPaths).toEqual(['/extensions/a/'])

      settingStore.settingValues['Comfy.Extension.DisabledPacks'] = []

      expect(store.changedExtensionPaths).toEqual(['/extensions/b/'])
    })

    it('restores a refused extension path change before a successful retry', async () => {
      const settingStore = useSettingStore()
      const store = useExtensionStore()
      settingStore.settingValues['Comfy.Extension.DisabledPacks'] = [
        '/extensions/a/',
        '/extensions/missing/'
      ]
      vi.spyOn(api, 'storeSetting')
        .mockResolvedValueOnce(new Response(null, { status: 400 }))
        .mockResolvedValueOnce(new Response())

      expect(await store.setExtensionPathEnabled('/extensions/a/', true)).toBe(
        'refused'
      )
      expect(settingStore.get('Comfy.Extension.DisabledPacks')).toEqual([
        '/extensions/a/',
        '/extensions/missing/'
      ])

      expect(await store.setExtensionPathEnabled('/extensions/a/', true)).toBe(
        'saved'
      )
      expect(settingStore.get('Comfy.Extension.DisabledPacks')).toEqual([
        '/extensions/missing/'
      ])
      expect(api.storeSetting).toHaveBeenNthCalledWith(
        2,
        'Comfy.Extension.DisabledPacks',
        ['/extensions/missing/']
      )
    })

    it('retains an extension path change after an indeterminate response', async () => {
      const settingStore = useSettingStore()
      const store = useExtensionStore()
      settingStore.settingValues['Comfy.Extension.DisabledPacks'] = []
      vi.spyOn(api, 'storeSetting').mockResolvedValue(
        new Response(null, { status: 500 })
      )

      expect(await store.setExtensionPathEnabled('/extensions/a/', false)).toBe(
        'indeterminate'
      )
      expect(settingStore.get('Comfy.Extension.DisabledPacks')).toEqual([
        '/extensions/a/'
      ])
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

  describe('extension toggles', () => {
    it('saves toggles against the current setting, keeping absent names and skipping read-only ones', async () => {
      const settingStore = useSettingStore()
      const store = useExtensionStore()
      vi.spyOn(api, 'storeSetting').mockResolvedValue(new Response())
      store.registerExtension({ name: 'a.ext' })
      store.registerExtension({ name: 'b.ext' })
      store.registerExtension({ name: 'pysssss.Locking' })
      store.loadDisabledExtensionNames([
        'ghost.ext',
        'b.ext',
        'pysssss.Locking'
      ])
      settingStore.settingValues['Comfy.Extension.Disabled'] = [
        'ghost.ext',
        'b.ext',
        'pysssss.Locking'
      ]

      await store.setExtensionsEnabled(['a.ext', 'pysssss.Locking'], false)
      await store.setExtensionsEnabled(['b.ext', 'pysssss.Locking'], true)

      expect(settingStore.get('Comfy.Extension.Disabled')).toEqual([
        'ghost.ext',
        'pysssss.Locking',
        'a.ext'
      ])
      expect(store.enabledByName).toEqual({
        'a.ext': false,
        'b.ext': true,
        'pysssss.Locking': false
      })
      expect(store.changedExtensions.map((ext) => ext.name)).toEqual([
        'a.ext',
        'b.ext'
      ])
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
