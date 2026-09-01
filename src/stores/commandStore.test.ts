import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCommandStore } from '@/stores/commandStore'

vi.mock('@/composables/useErrorHandling', () => ({
  useErrorHandling: () => ({
    wrapWithErrorHandlingAsync:
      (fn: () => Promise<void>, errorHandler?: (e: unknown) => void) =>
      async () => {
        try {
          await fn()
        } catch (e) {
          if (errorHandler) errorHandler(e)
          else throw e
        }
      }
  })
}))

vi.mock('@/platform/keybindings/keybindingStore', () => ({
  useKeybindingStore: () => ({
    getKeybindingByCommandId: () => null
  })
}))

describe('commandStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  describe('registerCommand', () => {
    it('registers a command by id', () => {
      const store = useCommandStore()
      store.registerCommand({
        id: 'test.command',
        function: vi.fn()
      })
      expect(store.isRegistered('test.command')).toBe(true)
    })

    it('warns on duplicate registration and overwrites with new function', async () => {
      const store = useCommandStore()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const originalFn = vi.fn()
      const replacementFn = vi.fn()
      store.registerCommand({ id: 'dup', function: originalFn })
      store.registerCommand({ id: 'dup', function: replacementFn })

      expect(warnSpy).toHaveBeenCalledWith('Command dup already registered')
      warnSpy.mockRestore()

      await store.getCommand('dup')?.function()
      expect(replacementFn).toHaveBeenCalled()
      expect(originalFn).not.toHaveBeenCalled()
    })
  })

  describe('getCommand', () => {
    it('returns the registered command', () => {
      const store = useCommandStore()
      const fn = vi.fn()
      store.registerCommand({ id: 'get.test', function: fn, label: 'Test' })
      const cmd = store.getCommand('get.test')
      expect(cmd).toBeDefined()
      expect(cmd?.label).toBe('Test')
    })

    it('returns undefined for unregistered command', () => {
      const store = useCommandStore()
      expect(store.getCommand('nonexistent')).toBeUndefined()
    })
  })

  describe('execute', () => {
    it('executes a registered command', async () => {
      const store = useCommandStore()
      const fn = vi.fn()
      store.registerCommand({ id: 'exec.test', function: fn })
      await store.execute('exec.test')
      expect(fn).toHaveBeenCalled()
    })

    it('throws for unregistered command', async () => {
      const store = useCommandStore()
      await expect(store.execute('missing')).rejects.toThrow(
        'Command missing not found'
      )
    })

    it('passes metadata to the command function', async () => {
      const store = useCommandStore()
      const fn = vi.fn()
      store.registerCommand({ id: 'meta.test', function: fn })
      await store.execute('meta.test', { metadata: { source: 'keyboard' } })
      expect(fn).toHaveBeenCalledWith({ source: 'keyboard' })
    })

    it('calls errorHandler on failure', async () => {
      const store = useCommandStore()
      const error = new Error('fail')
      store.registerCommand({
        id: 'err.test',
        function: () => {
          throw error
        }
      })
      const handler = vi.fn()
      await store.execute('err.test', { errorHandler: handler })
      expect(handler).toHaveBeenCalledWith(error)
    })
  })

  describe('isRegistered', () => {
    it('returns false for unregistered command', () => {
      const store = useCommandStore()
      expect(store.isRegistered('nope')).toBe(false)
    })
  })

  describe('loadExtensionCommands', () => {
    it('registers commands from an extension', () => {
      const store = useCommandStore()
      store.loadExtensionCommands({
        name: 'test-ext',
        commands: [
          { id: 'ext.cmd1', function: vi.fn(), label: 'Cmd 1' },
          { id: 'ext.cmd2', function: vi.fn(), label: 'Cmd 2' }
        ]
      })
      expect(store.isRegistered('ext.cmd1')).toBe(true)
      expect(store.isRegistered('ext.cmd2')).toBe(true)
      expect(store.getCommand('ext.cmd1')?.source).toBe('test-ext')
      expect(store.getCommand('ext.cmd2')?.source).toBe('test-ext')
    })

    it('skips extensions without commands', () => {
      const store = useCommandStore()
      store.loadExtensionCommands({ name: 'no-commands' })
      expect(store.commands).toHaveLength(0)
    })
  })

  describe('getCommand resolves dynamic properties', () => {
    it('resolves label as function', () => {
      const store = useCommandStore()
      store.registerCommand({
        id: 'label.fn',
        function: vi.fn(),
        label: () => 'Dynamic'
      })
      expect(store.getCommand('label.fn')?.label).toBe('Dynamic')
    })

    it('resolves tooltip as function', () => {
      const store = useCommandStore()
      store.registerCommand({
        id: 'tip.fn',
        function: vi.fn(),
        tooltip: () => 'Dynamic tip'
      })
      expect(store.getCommand('tip.fn')?.tooltip).toBe('Dynamic tip')
    })

    it('uses explicit menubarLabel over label', () => {
      const store = useCommandStore()
      store.registerCommand({
        id: 'mbl.explicit',
        function: vi.fn(),
        label: 'Label',
        menubarLabel: 'Menu Label'
      })
      expect(store.getCommand('mbl.explicit')?.menubarLabel).toBe('Menu Label')
    })

    it('falls back menubarLabel to label', () => {
      const store = useCommandStore()
      store.registerCommand({
        id: 'mbl.default',
        function: vi.fn(),
        label: 'My Label'
      })
      expect(store.getCommand('mbl.default')?.menubarLabel).toBe('My Label')
    })
  })

  describe('formatKeySequence', () => {
    it('returns empty string when command has no keybinding', () => {
      const store = useCommandStore()
      store.registerCommand({ id: 'no.kb', function: vi.fn() })
      const cmd = store.getCommand('no.kb')!
      expect(store.formatKeySequence(cmd)).toBe('')
    })
  })
})
