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

  it('takes a label that changes with state', async () => {
    // A toggle reads 'Follow execution', then 'Stop following execution'. The
    // command store already accepted a function; only our type was narrow.
    let following = false
    commands.register({
      id: 'KJNodes.follow',
      label: () =>
        following ? 'Stop following execution' : 'Follow execution',
      run: () => {
        following = !following
      }
    })

    const command = useCommandStore().getCommand('KJNodes.follow')!
    expect(command.label).toBe('Follow execution')

    await commands.run('KJNodes.follow')
    expect(command.label).toBe('Stop following execution')
  })

  it('scopes a keybinding to the canvas when asked', () => {
    // The host already withholds combos a text input owns, but a pack binding
    // something it does not — Ctrl+Up, say — would fire mid-sentence.
    commands.register({
      id: 'KJNodes.nudgeUp',
      label: 'Nudge up',
      run: () => {},
      keybinding: { key: 'ArrowUp', ctrl: true },
      scope: 'canvas'
    })

    const bound =
      useKeybindingStore().getKeybindingsByCommandId('KJNodes.nudgeUp')[0]
    expect(bound.targetElementId).toBe('graph-canvas')
  })

  it('leaves a keybinding application-wide by default', () => {
    commands.register({
      id: 'KJNodes.anywhere',
      label: 'Anywhere',
      run: () => {},
      keybinding: { key: 'k', alt: true }
    })

    const bound =
      useKeybindingStore().getKeybindingsByCommandId('KJNodes.anywhere')[0]
    expect(bound.targetElementId).toBeUndefined()
  })

  it('runs a command the host registered, by id', async () => {
    // Opening the mask editor was ComfyApp.copyToClipspace plus
    // clipspace_return_node plus invoking the command by hand. Asking for the
    // behaviour means the host need not publish the machinery behind it.
    const ran = vi.fn()
    useCommandStore().registerCommand({
      id: 'Comfy.MaskEditor.OpenMaskEditor',
      function: ran
    })

    await commands.run('Comfy.MaskEditor.OpenMaskEditor')

    expect(ran).toHaveBeenCalledTimes(1)
  })

  it('rejects a command id nothing registered', async () => {
    // A pack naming a command that has since been renamed should hear about
    // it rather than silently do nothing.
    await expect(commands.run('Comfy.Gone')).rejects.toThrow(/Comfy.Gone/)
  })

  it('reports whether a command exists, for a conditional entry', () => {
    expect(commands.has('Comfy.Nope')).toBe(false)
    commands.register({ id: 'KJNodes.x', label: 'X', run: () => {} })
    expect(commands.has('KJNodes.x')).toBe(true)
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

  it('plays an audio asset at the requested volume', async () => {
    class AudioStub {
      static readonly instances: AudioStub[] = []
      readonly play = vi.fn(async () => {})
      volume = 1

      constructor(readonly src: string) {
        AudioStub.instances.push(this)
      }
    }
    vi.stubGlobal('Audio', AudioStub)

    await commands.playSound({ src: '/extensions/Test/sound.mp3', volume: 0.4 })

    expect(AudioStub.instances).toHaveLength(1)
    expect(AudioStub.instances[0]).toMatchObject({
      src: '/extensions/Test/sound.mp3',
      volume: 0.4
    })
    expect(AudioStub.instances[0].play).toHaveBeenCalledOnce()
  })

  it('refuses an invalid sound volume', async () => {
    await expect(
      commands.playSound({ src: '/sound.mp3', volume: 2 })
    ).rejects.toThrow(ComfyApiError)
  })
})
