import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { useCommandStore } from '@/stores/commandStore'

import { useContextKeyStore } from './contextKeyStore'
import { useKeybindingStore } from './keybindingStore'
import type { RuntimeKeybinding } from './runtimeKeybindingStore'
import { useRuntimeKeybindingStore } from './runtimeKeybindingStore'
import { useKeybinding } from './useKeybinding'

const ID = 'Test.Runtime'

function provider(overrides: Partial<RuntimeKeybinding> = {}) {
  return {
    id: ID,
    label: 'Runtime test',
    binding: { combo: { key: 'k' } },
    enabled: () => true,
    run: vi.fn(),
    ...overrides
  } satisfies RuntimeKeybinding
}

function mount(options: RuntimeKeybinding) {
  const scope = effectScope()
  scope.run(() => useKeybinding(options))
  return scope
}

describe('useKeybinding', () => {
  it('registers a command and a default binding gated on its active context', async () => {
    const options = provider()
    mount(options)

    await useCommandStore().execute(ID)

    expect(options.run).toHaveBeenCalledOnce()
    expect(useKeybindingStore().getDefaultKeybindingsByCommandId(ID)).toEqual([
      expect.objectContaining({ when: `${ID}.active` })
    ])
    expect(useContextKeyStore().snapshot()[`${ID}.active`]).toBe(true)
    expect(useRuntimeKeybindingStore().isAvailable(ID)).toBe(true)
  })

  it('keeps the command and binding but drops the provider when its scope ends', async () => {
    const options = provider()
    mount(options).stop()

    await useCommandStore().execute(ID)

    expect(options.run).not.toHaveBeenCalled()
    expect(useCommandStore().isRegistered(ID)).toBe(true)
    expect(
      useKeybindingStore().getDefaultKeybindingsByCommandId(ID)
    ).toHaveLength(1)
    expect(useContextKeyStore().snapshot()[`${ID}.active`]).toBe(false)
    expect(useRuntimeKeybindingStore().isAvailable(ID)).toBe(false)
  })

  it('runs the most recently mounted enabled provider', async () => {
    const first = provider()
    const second = provider()
    const disabled = provider({ enabled: () => false })
    mount(first)
    mount(second)
    mount(disabled)

    await useCommandStore().execute(ID)

    expect(second.run).toHaveBeenCalledOnce()
    expect(first.run).not.toHaveBeenCalled()
    expect(disabled.run).not.toHaveBeenCalled()
  })

  it('registers a release command for hold bindings', async () => {
    const options = provider({ release: vi.fn() })
    mount(options)

    await useCommandStore().execute(`${ID}.Release`)

    expect(options.release).toHaveBeenCalledOnce()
    expect(useKeybindingStore().getDefaultKeybindingsByCommandId(ID)).toEqual([
      expect.objectContaining({ releaseCommandId: `${ID}.Release` })
    ])
  })
})
