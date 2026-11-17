import { KeybindingImpl } from '@comfyorg/keybindings/keybinding'
import { useKeybindingStore } from '@comfyorg/keybindings/keybindingStore'
import { reportError } from '@comfyorg/telemetry/reportError'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { useKeybindingService } from '@/platform/keybindings/keybindingService'
import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { CommandDef } from '@/platform/nodeApi/v4/types'

function commandsApi() {
  return createComfyApi({ getGraph: () => null }).comfy.commands
}

function command(overrides: Partial<CommandDef> = {}): CommandDef {
  return { id: 'MyPack.go', label: 'Go', run: vi.fn(), ...overrides }
}

function boundCombo(commandId: string) {
  const binding = useKeybindingStore().getKeybindingByCommandId(commandId)
  return (
    binding && {
      key: binding.combo.key,
      ctrl: binding.combo.ctrl,
      alt: binding.combo.alt,
      shift: binding.combo.shift,
      target: binding.targetElementId
    }
  )
}

function pressKey(target: HTMLElement, init: KeyboardEventInit) {
  if (!target.isConnected) {
    document.body.append(target)
    onTestFinished(() => target.remove())
  }
  const service = useKeybindingService()
  target.addEventListener('keydown', (event) => {
    void service.keybindHandler(event)
  })
  target.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  )
}

describe('registering a command', () => {
  it('adds a command that runs the pack function', async () => {
    const run = vi.fn()
    const commands = commandsApi()

    expect(commands.register(command({ run }))).toBe(true)

    expect(useCommandStore().getCommand('MyPack.go').label).toBe('Go')
    expect(await commands.run('MyPack.go')).toBe(true)
    expect(run).toHaveBeenCalledOnce()
  })

  it('shows the text a function label gives each time the host reads it', () => {
    let following = false
    commandsApi().register(
      command({ label: () => (following ? 'Stop following' : 'Follow') })
    )
    const registered = useCommandStore().getCommand('MyPack.go')

    expect([registered.label, registered.menubarLabel]).toEqual([
      'Follow',
      'Follow'
    ])
    following = true
    expect([registered.label, registered.menubarLabel]).toEqual([
      'Stop following',
      'Stop following'
    ])
  })

  it('reports a function label that throws, and shows the id instead', () => {
    const broken = new Error('pack label failed')
    commandsApi().register(
      command({
        label: () => {
          throw broken
        }
      })
    )

    expect(useCommandStore().getCommand('MyPack.go').label).toBe('MyPack.go')
    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      broken,
      expect.objectContaining({ tags: { event: 'commands.register' } })
    )
  })

  it('shows the id for a function label that gives no string', () => {
    const label = vi.fn(() => 7)
    const commands = commandsApi()
    Reflect.apply(commands.register, commands, [{ ...command(), label }])

    expect(useCommandStore().getCommand('MyPack.go').label).toBe('MyPack.go')
    expect(label).toHaveBeenCalledOnce()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('binds its key as a default, Cmd matching as Ctrl', () => {
    const commands = commandsApi()
    commands.register(
      command({
        id: 'MyPack.a',
        keybinding: { key: 'k', alt: true, shift: true }
      })
    )
    commands.register(
      command({
        id: 'MyPack.b',
        keybinding: { key: 's', meta: true },
        scope: 'canvas'
      })
    )

    expect(boundCombo('MyPack.a')).toEqual({
      key: 'k',
      ctrl: false,
      alt: true,
      shift: true,
      target: undefined
    })
    expect(boundCombo('MyPack.b')).toEqual({
      key: 's',
      ctrl: true,
      alt: false,
      shift: false,
      target: 'graph-canvas'
    })
  })

  it('runs the command when its key is pressed', async () => {
    const run = vi.fn()
    commandsApi().register(
      command({ run, keybinding: { key: 'k', ctrl: true, shift: true } })
    )

    pressKey(document.createElement('div'), {
      key: 'k',
      ctrlKey: true,
      shiftKey: true
    })
    await Promise.resolve()

    expect(run).toHaveBeenCalledOnce()
  })

  it.for([
    { place: 'inside the graph', inGraph: true, runs: 1 },
    { place: 'in a field outside the graph', inGraph: false, runs: 0 }
  ])('runs a canvas key $place $runs time(s)', async ({ inGraph, runs }) => {
    const run = vi.fn()
    commandsApi().register(
      command({
        run,
        keybinding: { key: 'k', ctrl: true, shift: true },
        scope: 'canvas'
      })
    )
    const graph = document.createElement('div')
    graph.id = inGraph ? 'graph-canvas-container' : 'sidebar'
    const field = document.createElement('input')
    graph.append(field)
    document.body.append(graph)
    onTestFinished(() => graph.remove())

    pressKey(field, { key: 'k', ctrlKey: true, shiftKey: true })
    await Promise.resolve()

    expect(run).toHaveBeenCalledTimes(runs)
  })

  it('adds the command without its key when another command holds the key, and says so', () => {
    useKeybindingStore().addDefaultKeybinding(
      new KeybindingImpl({
        commandId: 'Comfy.SaveWorkflow',
        combo: { key: 's', ctrl: true }
      })
    )

    expect(
      commandsApi().register(command({ keybinding: { key: 's', ctrl: true } }))
    ).toBe(false)
    expect(useCommandStore().isRegistered('MyPack.go')).toBe(true)
    expect(boundCombo('MyPack.go')).toBeUndefined()
    expect(boundCombo('Comfy.SaveWorkflow')).toMatchObject({ key: 's' })
  })

  it('refuses an id another command has, and changes nothing', () => {
    const first = vi.fn()
    const commands = commandsApi()
    commands.register(command({ run: first }))

    expect(() =>
      commands.register(command({ label: 'Other', keybinding: { key: 'q' } }))
    ).toThrow(
      new TypeError(
        "commands.register needs an id no other command has, not 'MyPack.go'."
      )
    )
    expect(useCommandStore().getCommand('MyPack.go').label).toBe('Go')
    expect(boundCombo('MyPack.go')).toBeUndefined()
  })

  it.for([
    { name: 'no command', definition: null, needs: 'a command' },
    {
      name: 'an empty id',
      definition: command({ id: '' }),
      needs: 'id as a non-empty string no object inherits'
    },
    {
      name: 'a label that is neither text nor a function',
      definition: { ...command(), label: 5 },
      needs: 'label as a string or a function that returns one'
    },
    {
      name: 'no run function',
      definition: { ...command(), run: 'go' },
      needs: 'run as a function'
    },
    {
      name: 'a key combo that is a string',
      definition: { ...command(), keybinding: 'ctrl+k' },
      needs: 'keybinding as a key combo'
    },
    {
      name: 'a combo without a key',
      definition: { ...command(), keybinding: { ctrl: true } },
      needs: 'keybinding.key as a key name'
    },
    {
      name: 'a modifier that is not a boolean',
      definition: { ...command(), keybinding: { key: 'k', shift: 1 } },
      needs: 'keybinding.shift as a boolean'
    },
    {
      name: 'an unknown scope',
      definition: { ...command(), scope: 'window' },
      needs: "scope as 'canvas'"
    }
  ])('refuses $name, and adds nothing', ({ definition, needs }) => {
    const commands = commandsApi()

    expect(() =>
      Reflect.apply(commands.register, commands, [definition])
    ).toThrow(
      expect.objectContaining({
        name: 'TypeError',
        message: expect.stringContaining(
          `commands.register needs ${needs}, not `
        )
      })
    )
    expect(useCommandStore().commands).toEqual([])
    expect(useKeybindingStore().keybindings).toEqual([])
  })
})

describe('running a command', () => {
  it('runs a command core registered', async () => {
    const save = vi.fn()
    useCommandStore().registerCommand({
      id: 'Comfy.SaveWorkflow',
      function: save
    })

    expect(await commandsApi().run('Comfy.SaveWorkflow')).toBe(true)
    expect(save).toHaveBeenCalledOnce()
  })

  it('resolves false for an id no command has', async () => {
    expect(await commandsApi().run('MyPack.missing')).toBe(false)
  })

  it.for(['constructor', 'toString', '__proto__'])(
    'resolves false for %s, which every object inherits, and refuses to register it',
    async (id) => {
      const commands = commandsApi()

      expect(await commands.run(id)).toBe(false)
      expect(() => commands.register(command({ id }))).toThrow(
        new TypeError(
          `commands.register needs id as a non-empty string no object inherits, not '${id}'.`
        )
      )
    }
  )

  it('shows the user a command that fails, as for any command', async () => {
    const commands = commandsApi()
    commands.register(
      command({
        run: async () => {
          throw new Error('pack command failed')
        }
      })
    )

    expect(await commands.run('MyPack.go')).toBe(true)
    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'error',
        description: 'pack command failed'
      })
    ])
  })

  it.for([undefined, '', 4])('refuses %j as an id', (id) => {
    const commands = commandsApi()

    expect(() => Reflect.apply(commands.run, commands, [id])).toThrow(TypeError)
  })
})

describe('notifying the user', () => {
  it.for([
    { severity: 'success', kind: 'success' },
    { severity: 'info', kind: 'info' },
    { severity: 'warn', kind: 'warning' },
    { severity: 'error', kind: 'error' },
    { severity: undefined, kind: 'info' }
  ] as const)(
    'shows a $severity notification as a $kind toast',
    ({ severity, kind }) => {
      commandsApi().notify({
        severity,
        summary: 'Saved',
        detail: 'All done',
        life: 3000
      })

      expect(useToast().toasts).toEqual([
        expect.objectContaining({
          kind,
          title: 'Saved',
          description: 'All done',
          duration: 3000
        })
      ])
    }
  )

  it('leaves a notification without a life open until the user closes it', () => {
    commandsApi().notify({ summary: 'Saved' })

    expect(useToast().toasts).toEqual([
      expect.objectContaining({ duration: Number.POSITIVE_INFINITY })
    ])
  })

  it.for([
    { name: 'no notification', notification: 'Saved', needs: 'a notification' },
    {
      name: 'no summary',
      notification: { detail: 'x' },
      needs: 'summary as a string'
    },
    {
      name: 'the host spelling of a severity',
      notification: { summary: 's', severity: 'warning' },
      needs: 'severity as success, info, warn or error'
    },
    {
      name: 'a detail that is not text',
      notification: { summary: 's', detail: 1 },
      needs: 'detail as a string'
    },
    {
      name: 'a life that is not finite',
      notification: { summary: 's', life: Number.NaN },
      needs: 'life as a positive number'
    },
    {
      name: 'a life of zero',
      notification: { summary: 's', life: 0 },
      needs: 'life as a positive number'
    }
  ])('refuses $name, and shows nothing', ({ notification, needs }) => {
    const commands = commandsApi()

    expect(() =>
      Reflect.apply(commands.notify, commands, [notification])
    ).toThrow(
      expect.objectContaining({
        message: expect.stringContaining(`commands.notify needs ${needs}, not `)
      })
    )
    expect(useToast().toasts).toEqual([])
  })
})
