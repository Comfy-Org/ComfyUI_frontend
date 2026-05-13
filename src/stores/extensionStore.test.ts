import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useExtensionStore } from '@/stores/extensionStore'

describe('extensionStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

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
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      try {
        store.loadDisabledExtensionNames(['disabled.ext'])
        store.registerExtension({ name: 'disabled.ext' })
        expect(warnSpy).toHaveBeenCalledWith(
          'Extension disabled.ext is disabled.'
        )
        expect(store.isExtensionInstalled('disabled.ext')).toBe(true)
        expect(store.isExtensionEnabled('disabled.ext')).toBe(false)
      } finally {
        warnSpy.mockRestore()
      }
    })
  })

  describe('isExtensionInstalled', () => {
    it('returns false for uninstalled extension', () => {
      const store = useExtensionStore()
      expect(store.isExtensionInstalled('missing')).toBe(false)
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
