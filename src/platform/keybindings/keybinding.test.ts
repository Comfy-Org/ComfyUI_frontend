import { describe, expect, it } from 'vitest'

import { KeybindingImpl } from './keybinding'
import { zKeybinding } from './types'

describe('KeybindingImpl', () => {
  it('treats bindings that differ only by dialog scope as distinct', () => {
    const workspace = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'z', ctrl: true }
    })
    const scoped = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'z', ctrl: true },
      dialogKey: 'global-mask-editor'
    })

    expect(workspace.equals(scoped)).toBe(false)
    expect(workspace.serialize()).not.toBe(scoped.serialize())
    expect(
      scoped.equals(
        new KeybindingImpl({
          commandId: 'test.command',
          combo: { key: 'z', ctrl: true },
          dialogKey: 'global-mask-editor'
        })
      )
    ).toBe(true)
  })

  it('keeps scope fields that contain the separator apart', () => {
    const combo = { key: 'z', ctrl: true }
    const a = new KeybindingImpl({
      commandId: 'test.command',
      combo,
      targetElementId: 'canvas:mask',
      dialogKey: 'editor'
    })
    const b = new KeybindingImpl({
      commandId: 'test.command',
      combo,
      targetElementId: 'canvas',
      dialogKey: 'mask:editor'
    })

    expect(a.serialize()).not.toBe(b.serialize())
  })

  it('serializes only the persisted fields', () => {
    const binding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'z', ctrl: true },
      dialogKey: 'global-mask-editor'
    })

    expect(JSON.parse(JSON.stringify(binding))).toMatchObject({
      commandId: 'test.command',
      dialogKey: 'global-mask-editor'
    })
  })

  it('canonicalizes the when clause so spellings compare equal', () => {
    const binding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'w' },
      when: 'b && !a'
    })

    expect(binding.when).toBe('!a && b')
    expect(
      binding.equals(
        new KeybindingImpl({
          commandId: 'test.command',
          combo: { key: 'w' },
          when: '!a&&b'
        })
      )
    ).toBe(true)
  })

  it('treats empty scope fields as absent', () => {
    const binding = new KeybindingImpl({
      commandId: 'test.command',
      combo: { key: 'z', ctrl: true },
      dialogKey: '',
      targetElementId: ''
    })

    expect(binding.dialogKey).toBeUndefined()
    expect(binding.targetElementId).toBeUndefined()
    expect(
      binding.equals(
        new KeybindingImpl({
          commandId: 'test.command',
          combo: { key: 'z', ctrl: true }
        })
      )
    ).toBe(true)
  })
})

describe('zKeybinding', () => {
  it('accepts null optional fields from extensions', () => {
    const result = zKeybinding.safeParse({
      commandId: 'test.command',
      combo: { key: 'k', ctrl: true },
      targetElementId: null
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.targetElementId).toBeUndefined()
  })
})
