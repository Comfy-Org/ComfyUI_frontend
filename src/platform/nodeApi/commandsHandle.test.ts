/**
 * Commands, keys and notifications reach the real stores.
 *
 * Asserted through `useCommandStore`, `useKeybindingStore` and `useToastStore`
 * rather than mocks of them: several capabilities this week were unit-tested in
 * isolation and never connected to anything, so proving the wiring is the point.
 */
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { useCommandStore } from '@/stores/commandStore'

import { createCommandsApi } from './commandsHandle'
import type { CommandsHandle } from './commandsHandle'
import { ComfyApiError } from './errors'

vi.mock('@/scripts/api', () => ({
  api: {
    getSettings: vi.fn(async () => ({})),
    storeSetting: vi.fn(async () => {}),
    addEventListener: vi.fn()
  }
}))

describe('pack commands', () => {
  let commands: CommandsHandle

  beforeEach(() => {
    setActivePinia(createPinia())
    commands = createCommandsApi()
  })

  it('registers a command the store can then run', async () => {
    const ran = vi.fn()
    commands.register({ id: 'KJNodes.doIt', label: 'Do it', run: ran })

    await useCommandStore().execute('KJNodes.doIt')

    expect(ran).toHaveBeenCalled()
  })

  it('binds a key to the command when one is given', () => {
    commands.register({
      id: 'KJNodes.doIt',
      label: 'Do it',
      run: () => {},
      keybinding: { key: 'k', ctrl: true }
    })

    const bound = useKeybindingStore().getKeybindingsByCommandId('KJNodes.doIt')

    expect(bound).toHaveLength(1)
  })

  it('leaves a command unbound when no key is given', () => {
    commands.register({ id: 'KJNodes.doIt', label: 'Do it', run: () => {} })

    expect(
      useKeybindingStore().getKeybindingsByCommandId('KJNodes.doIt')
    ).toEqual([])
  })

  it('refuses an id that is not namespaced', () => {
    // One flat space shared with core and every other pack.
    expect(() =>
      commands.register({ id: 'doIt', label: 'Do it', run: () => {} })
    ).toThrow(ComfyApiError)
  })

  it('raises a notification through the toast store', () => {
    commands.notify({ severity: 'warn', summary: 'Careful', detail: 'why' })

    expect(useToastStore().messagesToAdd).toContainEqual(
      expect.objectContaining({ severity: 'warn', summary: 'Careful' })
    )
  })
})
