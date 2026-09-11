import { zKeybinding } from '@/platform/keybindings/types'
import { effectScope, nextTick, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingStore } from '@/platform/settings/settingStore'
import * as telemetry from '@/platform/telemetry/reportError'
import { useCommandStore } from '@/stores/commandStore'

import { KeybindingImpl } from './keybinding'
import { useKeybindingService } from './keybindingService'
import { useKeybindingStore } from './keybindingStore'
import { useRuntimeKeybindingStore } from './runtimeKeybindingStore'
import { useKeybinding } from './useKeybinding'

function keyEvent(
  type: 'keydown' | 'keyup',
  init: KeyboardEventInit,
  target: EventTarget = document.body
) {
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    ...init
  })
  target.dispatchEvent(event)
  return event
}

describe('capture keybinding dispatch', () => {
  const disposers: (() => void)[] = []

  beforeEach(() => {
    useSettingStore().settingValues['Comfy.Keybinding.CapturePhase'] = true
    vi.spyOn(telemetry, 'reportError').mockImplementation(() => {})
    disposers.push(useKeybindingService().install())
  })

  afterEach(() => {
    for (const dispose of disposers.splice(0).reverse()) dispose()
  })

  function register(
    run = vi.fn(),
    binding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'k', ctrl: true }
    })
  ) {
    useCommandStore().registerCommand({ id: binding.commandId, function: run })
    useKeybindingStore().addDefaultKeybinding(binding)
    return run
  }

  it('claims a shortcut before target listeners without hiding the event from them', () => {
    const run = register()
    const button = document.createElement('button')
    document.body.appendChild(button)
    disposers.push(() => button.remove())
    const observed: boolean[] = []
    button.addEventListener('keydown', (event) => {
      observed.push(event.defaultPrevented)
      if (!event.defaultPrevented) run()
      event.stopPropagation()
    })

    keyEvent('keydown', { key: 'k', ctrlKey: true }, button)

    expect(run).toHaveBeenCalledOnce()
    expect(observed).toEqual([true])
  })

  it('does not evaluate unrelated mounted surfaces for a keypress', () => {
    const enabled = vi.fn(() => true)
    disposers.push(
      useRuntimeKeybindingStore().register({
        id: 'test.preview',
        label: 'Preview',
        binding: { combo: { key: 'ArrowRight' } },
        enabled,
        run: vi.fn()
      })
    )
    keyEvent('keydown', { key: 'x' })
    expect(enabled).not.toHaveBeenCalled()
    keyEvent('keydown', { key: 'ArrowRight' })
    expect(enabled).toHaveBeenCalled()
  })

  it('switches phases live and removes the previous listener', async () => {
    const run = register()
    const button = document.createElement('button')
    document.body.appendChild(button)
    disposers.push(() => button.remove())
    button.addEventListener('keydown', (event) => event.preventDefault())

    keyEvent('keydown', { key: 'k', ctrlKey: true }, button)
    useSettingStore().settingValues['Comfy.Keybinding.CapturePhase'] = false
    await nextTick()
    keyEvent('keydown', { key: 'k', ctrlKey: true }, button)
    expect(run).toHaveBeenCalledOnce()

    useSettingStore().settingValues['Comfy.Keybinding.CapturePhase'] = true
    await nextTick()
    keyEvent('keydown', { key: 'k', ctrlKey: true }, button)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('respects native text editing and explicit isolation through shadow roots', () => {
    const run = register(
      vi.fn(),
      new KeybindingImpl({
        commandId: 'test.command',
        combo: { key: 'z', ctrl: true }
      })
    )
    const host = document.createElement('div')
    const root = host.attachShadow({ mode: 'open' })
    const input = document.createElement('input')
    const button = document.createElement('button')
    root.append(input, button)
    document.body.appendChild(host)
    disposers.push(() => host.remove())

    expect(
      keyEvent('keydown', { key: 'z', ctrlKey: true }, input).defaultPrevented
    ).toBe(false)
    host.setAttribute('data-comfy-keybinding-ignore', '')
    expect(
      keyEvent('keydown', { key: 'z', ctrlKey: true }, button).defaultPrevented
    ).toBe(false)
    expect(run).not.toHaveBeenCalled()
    host.removeAttribute('data-comfy-keybinding-ignore')
    keyEvent('keydown', { key: 'z', ctrlKey: true }, button)
    expect(run).toHaveBeenCalledOnce()
  })

  it('suppresses repeat actions while still claiming the shortcut', () => {
    const run = register(
      vi.fn(),
      new KeybindingImpl({
        commandId: 'test.command',
        combo: { key: 'k', ctrl: true },
        allowRepeat: false
      })
    )
    keyEvent('keydown', { key: 'k', ctrlKey: true })
    expect(
      keyEvent('keydown', { key: 'k', ctrlKey: true, repeat: true })
        .defaultPrevented
    ).toBe(true)
    expect(run).toHaveBeenCalledOnce()
  })

  it('reports rejected commands once per execution and keeps later shortcuts working', async () => {
    const failure = new Error('command failed')
    const run = register(vi.fn().mockRejectedValueOnce(failure))
    keyEvent('keydown', { key: 'k', ctrlKey: true })
    await vi.waitFor(() => expect(telemetry.reportError).toHaveBeenCalledOnce())
    expect(telemetry.reportError).toHaveBeenCalledWith(failure, {
      errorType: 'error_executing_keybinding',
      level: 'error',
      tags: {
        command_id: 'test.command',
        source_tier: 'core',
        extension: undefined
      }
    })
    keyEvent('keydown', { key: 'k', ctrlKey: true })
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('reports an unavailable command once while leaving its key unclaimed', () => {
    useKeybindingStore().addUserKeybinding(
      new KeybindingImpl({
        commandId: 'test.missing',
        combo: { key: 'k', ctrl: true }
      })
    )
    for (let index = 0; index < 3; index++) {
      expect(
        keyEvent('keydown', { key: 'k', ctrlKey: true }).defaultPrevented
      ).toBe(false)
    }
    expect(telemetry.reportError).toHaveBeenCalledOnce()
  })

  it('releases the physical key after modifiers change and does not repeat a hold', async () => {
    const run = vi.fn()
    const release = vi.fn()
    disposers.push(
      useRuntimeKeybindingStore().register({
        id: 'test.hold',
        label: 'Hold',
        binding: { combo: { key: 'k', ctrl: true } },
        enabled: () => true,
        run,
        release
      })
    )

    keyEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true })
    keyEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, repeat: true })
    keyEvent('keyup', { key: 'K', code: 'KeyK' })
    await vi.waitFor(() => expect(release).toHaveBeenCalledOnce())
    window.dispatchEvent(new Event('blur'))
    expect(run).toHaveBeenCalledOnce()
    expect(release).toHaveBeenCalledOnce()
  })

  it('waits for an asynchronous press before releasing after synchronous blur', async () => {
    let finishPress: (() => void) | undefined
    const pressed = new Promise<void>((resolve) => {
      finishPress = resolve
    })
    const release = vi.fn()
    disposers.push(
      useRuntimeKeybindingStore().register({
        id: 'test.hold',
        label: 'Hold',
        binding: { combo: { key: ' ' } },
        enabled: () => true,
        run: () => {
          window.dispatchEvent(new Event('blur'))
          return pressed
        },
        release
      })
    )
    keyEvent('keydown', { key: ' ', code: 'Space' })
    await nextTick()
    expect(release).not.toHaveBeenCalled()
    finishPress?.()
    await vi.waitFor(() => expect(release).toHaveBeenCalledOnce())
  })

  it('cleans up the original instance when its context or lifetime ends', async () => {
    const enabled = ref(true)
    const release = vi.fn()
    const scope = effectScope()
    scope.run(() =>
      useKeybinding({
        id: 'test.hold',
        label: 'Hold',
        binding: { combo: { key: ' ' } },
        enabled: () => enabled.value,
        run: vi.fn(),
        release
      })
    )
    disposers.push(() => scope.stop())

    keyEvent('keydown', { key: ' ', code: 'Space' })
    enabled.value = false
    await vi.waitFor(() => expect(release).toHaveBeenCalledOnce())
    enabled.value = true
    keyEvent('keydown', { key: ' ', code: 'Space' })
    scope.stop()
    await vi.waitFor(() => expect(release).toHaveBeenCalledTimes(2))
  })

  it('preserves a rebind across unmount and chooses the most recent active instance', () => {
    const first = vi.fn()
    const second = vi.fn()
    const runtime = useRuntimeKeybindingStore()
    const options = {
      id: 'test.local',
      label: 'Local',
      binding: { combo: { key: 'k', ctrl: true } },
      enabled: () => true
    }
    const removeFirst = runtime.register({ ...options, run: first })
    disposers.push(removeFirst)
    const defaults = useKeybindingStore().getDefaultKeybindingsByCommandId(
      options.id
    )[0]
    useKeybindingStore().updateSpecificKeybinding(
      defaults,
      new KeybindingImpl({
        ...zKeybinding.parse(defaults),
        combo: { key: 'l', ctrl: true }
      })
    )
    const removeSecond = runtime.register({ ...options, run: second })
    disposers.push(removeSecond)

    keyEvent('keydown', { key: 'l', ctrlKey: true })
    expect(second).toHaveBeenCalledOnce()
    expect(first).not.toHaveBeenCalled()
    removeSecond()
    keyEvent('keydown', { key: 'l', ctrlKey: true })
    expect(first).toHaveBeenCalledOnce()
    removeFirst()
    disposers.push(runtime.register({ ...options, run: first }))
    keyEvent('keydown', { key: 'k', ctrlKey: true })
    expect(first).toHaveBeenCalledOnce()
    keyEvent('keydown', { key: 'l', ctrlKey: true })
    expect(first).toHaveBeenCalledTimes(2)
  })
})
