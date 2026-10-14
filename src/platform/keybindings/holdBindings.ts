import { shallowRef } from 'vue'

import type { KeybindingImpl } from './keybinding'

interface HoldActions {
  press: () => void | Promise<void>
  release: () => void | Promise<void>
  isActive: () => boolean
}

export function createHoldBindings(
  onError: (
    error: unknown,
    binding: KeybindingImpl,
    phase: 'press' | 'release'
  ) => void
) {
  const active = shallowRef(
    new Map<
      string,
      { binding: KeybindingImpl; release: () => void; isActive: () => boolean }
    >()
  )
  const physicalKey = (event: KeyboardEvent) =>
    event.code || event.key.toUpperCase()
  const releasing = new Set<string>()

  function press(
    binding: KeybindingImpl,
    event: KeyboardEvent,
    actions: HoldActions
  ) {
    const key = physicalKey(event)
    if (active.value.has(key) || releasing.has(key)) return
    let finishPress: (() => void) | undefined
    const completed = new Promise<void>((resolve) => {
      finishPress = resolve
    })
    active.value = new Map(active.value).set(key, {
      binding,
      isActive: actions.isActive,
      release: () => {
        releasing.add(key)
        void completed
          .then(actions.release)
          .catch((error: unknown) => onError(error, binding, 'release'))
          .finally(() => releasing.delete(key))
      }
    })
    try {
      void Promise.resolve(actions.press())
        .catch((error: unknown) => {
          onError(error, binding, 'press')
          release(key)
        })
        .finally(() => finishPress?.())
    } catch (error) {
      onError(error, binding, 'press')
      finishPress?.()
      release(key)
    }
  }

  function release(key: string) {
    const held = active.value.get(key)
    if (!held) return
    const remaining = new Map(active.value)
    remaining.delete(key)
    active.value = remaining
    held.release()
  }

  function releaseAll() {
    for (const key of active.value.keys()) release(key)
  }

  function reconcile(matches: (binding: KeybindingImpl) => boolean) {
    for (const [key, held] of active.value) {
      if (!held.isActive() || !matches(held.binding)) release(key)
    }
  }

  return {
    press,
    releaseAll,
    reconcile,
    keyup: (event: KeyboardEvent) => release(physicalKey(event))
  }
}
