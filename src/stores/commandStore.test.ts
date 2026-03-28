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

    it('warns on duplicate registration', () => {
      const store = useCommandStore()
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      store.registerCommand({ id: 'dup', function: vi.fn() })
      store.registerCommand({ id: 'dup', function: vi.fn() })

      expect(warnSpy).toHaveBeenCalledWith('Command dup already registered')
      warnSpy.mockRestore()
    })
  })

  describe('registerCommands', () => {
    it('registers multiple commands at once', () => {
      const store = useCommandStore()
      store.registerCommands([
        { id: 'cmd.a', function: vi.fn() },
        { id: 'cmd.b', function: vi.fn() }
      ])
      expect(store.isRegistered('cmd.a')).toBe(true)
      expect(store.isRegistered('cmd.b')).toBe(true)
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

  describe('commands getter', () => {
    it('returns all registered commands as an array', () => {
      const store = useCommandStore()
      store.registerCommand({ id: 'a', function: vi.fn() })
      store.registerCommand({ id: 'b', function: vi.fn() })
      expect(store.commands).toHaveLength(2)
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
    })

    it('skips extensions without commands', () => {
      const store = useCommandStore()
      store.loadExtensionCommands({ name: 'no-commands' })
      expect(store.commands).toHaveLength(0)
    })
  })

  describe('ComfyCommandImpl', () => {
    it('resolves label as string', () => {
      const store = useCommandStore()
      store.registerCommand({
        id: 'label.str',
        function: vi.fn(),
        label: 'Static'
      })
      expect(store.getCommand('label.str')?.label).toBe('Static')
    })

    it('resolves label as function', () => {
      const store = useCommandStore()
      store.registerCommand({
        id: 'label.fn',
        function: vi.fn(),
        label: () => 'Dynamic'
      })
      expect(store.getCommand('label.fn')?.label).toBe('Dynamic')
    })

    it('resolves icon as function', () => {
      const store = useCommandStore()
      store.registerCommand({
        id: 'icon.fn',
        function: vi.fn(),
        icon: () => 'pi pi-check'
      })
      expect(store.getCommand('icon.fn')?.icon).toBe('pi pi-check')
    })

    it('uses label as default menubarLabel', () => {
      const store = useCommandStore()
      store.registerCommand({
        id: 'mbl.default',
        function: vi.fn(),
        label: 'My Label'
      })
      expect(store.getCommand('mbl.default')?.menubarLabel).toBe('My Label')
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
  })
})
