import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useHelpCommands } from '@/composables/useHelpCommands'

const mockLocale = ref('en')
vi.mock('vue-i18n', async () => {
  const actual = await vi.importActual('vue-i18n')
  return {
    ...actual,
    useI18n: vi.fn(() => ({
      locale: mockLocale
    }))
  }
})

vi.mock('@/stores/firebaseAuthStore', () => ({
  useFirebaseAuthStore: vi.fn(() => ({}))
}))

vi.mock('@/composables/auth/useFirebaseAuth', () => ({
  useFirebaseAuth: vi.fn(() => null)
}))

vi.mock('firebase/auth', () => ({
  setPersistence: vi.fn(),
  browserLocalPersistence: {},
  onAuthStateChanged: vi.fn()
}))

vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: vi.fn(() => ({
    showAbout: vi.fn()
  }))
}))

describe('useHelpCommands', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns all help command objects', () => {
    const commands = useHelpCommands()
    expect(commands.length).toBe(6)
  })

  it('includes expected command IDs', () => {
    const commands = useHelpCommands()
    const ids = commands.map((c) => c.id)
    expect(ids).toContain('Comfy.Help.OpenComfyUIIssues')
    expect(ids).toContain('Comfy.Help.OpenComfyUIDocs')
    expect(ids).toContain('Comfy.Help.OpenComfyOrgDiscord')
    expect(ids).toContain('Comfy.Help.AboutComfyUI')
    expect(ids).toContain('Comfy.Help.OpenComfyUIForum')
    expect(ids).toContain('Comfy.ContactSupport')
  })

  it('all commands have required function property', () => {
    const commands = useHelpCommands()
    for (const command of commands) {
      expect(typeof command.function).toBe('function')
    }
  })

  it('all commands have labels and icons', () => {
    const commands = useHelpCommands()
    for (const command of commands) {
      expect(command.label).toBeTruthy()
      expect(command.icon).toBeTruthy()
    }
  })

  it('opens external URLs when help commands are invoked', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    const commands = useHelpCommands()
    const issuesCommand = commands.find(
      (c) => c.id === 'Comfy.Help.OpenComfyUIIssues'
    )!
    issuesCommand.function()
    expect(openSpy).toHaveBeenCalledWith(expect.any(String), '_blank')

    openSpy.mockRestore()
  })
})
