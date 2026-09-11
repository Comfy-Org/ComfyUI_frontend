import { describe, expect, it, vi } from 'vitest'

import { createHoldBindings } from './holdBindings'
import { KeybindingImpl } from './keybinding'

const binding = new KeybindingImpl({
  commandId: 'test.hold',
  combo: { key: ' ' }
})

function space(type: 'keydown' | 'keyup') {
  return new KeyboardEvent(type, { key: ' ', code: 'Space' })
}

function hold(overrides: { press?: () => void | Promise<void> } = {}) {
  const onError = vi.fn()
  const holds = createHoldBindings(onError)
  const actions = {
    press: vi.fn(overrides.press ?? (() => {})),
    release: vi.fn(),
    isActive: vi.fn(() => true)
  }
  holds.press(binding, space('keydown'), actions)
  return { holds, actions, onError }
}

describe('createHoldBindings', () => {
  it('releases once, after an asynchronous press settles', async () => {
    let finishPress = () => {}
    const { holds, actions } = hold({
      press: () =>
        new Promise<void>((resolve) => {
          finishPress = resolve
        })
    })

    holds.keyup(space('keyup'))
    holds.keyup(space('keyup'))
    expect(actions.release).not.toHaveBeenCalled()

    finishPress()
    await vi.waitFor(() => expect(actions.release).toHaveBeenCalledOnce())
  })

  it('ignores a second press while the key is held', () => {
    const { holds, actions } = hold()

    holds.press(binding, space('keydown'), actions)

    expect(actions.press).toHaveBeenCalledOnce()
  })

  it('releases every held key on releaseAll', async () => {
    const { holds, actions } = hold()

    holds.releaseAll()
    holds.releaseAll()

    await vi.waitFor(() => expect(actions.release).toHaveBeenCalledOnce())
  })

  it.for([
    {
      reason: 'its provider is no longer active',
      active: false,
      matches: true
    },
    { reason: 'its binding no longer matches', active: true, matches: false }
  ])('releases a hold when $reason', async ({ active, matches }) => {
    const { holds, actions } = hold()
    actions.isActive.mockReturnValue(active)

    holds.reconcile(() => matches)

    await vi.waitFor(() => expect(actions.release).toHaveBeenCalledOnce())
  })

  it('keeps a hold whose provider and binding still apply', async () => {
    const { holds, actions } = hold()

    holds.reconcile(() => true)
    await Promise.resolve()

    expect(actions.release).not.toHaveBeenCalled()
  })

  it('reports a failed press and still releases it once', async () => {
    const failure = new Error('press failed')
    const { actions, onError } = hold({
      press: () => {
        throw failure
      }
    })

    expect(onError).toHaveBeenCalledWith(failure, binding, 'press')
    await vi.waitFor(() => expect(actions.release).toHaveBeenCalledOnce())
  })
})
