import { computed, shallowRef } from 'vue'

/**
 * Undo and redo over whole snapshots of a value. Changes that share a `key`
 * in a row (one slider dragged) undo as one step.
 */
export function useSnapshotHistory<T>(initial: T) {
  const state = shallowRef(initial)
  const past = shallowRef<readonly T[]>([])
  const future = shallowRef<readonly T[]>([])
  let lastKey: string | undefined

  function reset(next: T) {
    state.value = next
    past.value = []
    future.value = []
    lastKey = undefined
  }

  function change(next: T, key?: string) {
    if (!key || key !== lastKey) {
      past.value = [...past.value, state.value]
      future.value = []
    }
    lastKey = key
    state.value = next
  }

  function undo() {
    const previous = past.value.at(-1)
    if (previous === undefined) return
    future.value = [state.value, ...future.value]
    past.value = past.value.slice(0, -1)
    state.value = previous
    lastKey = undefined
  }

  function redo() {
    const next = future.value.at(0)
    if (next === undefined) return
    past.value = [...past.value, state.value]
    future.value = future.value.slice(1)
    state.value = next
    lastKey = undefined
  }

  return {
    state,
    canUndo: computed(() => past.value.length > 0),
    canRedo: computed(() => future.value.length > 0),
    reset,
    change,
    undo,
    redo
  }
}
