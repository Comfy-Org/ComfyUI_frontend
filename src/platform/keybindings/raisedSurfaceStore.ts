import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

/**
 * Tracks open "raised surfaces" — popovers, context menus, and top-level
 * modals — that should suppress global keybindings while they are open.
 *
 * UX axiom: standard keybindings work in every context EXCEPT when a raised
 * surface is open. Consumers register/unregister surfaces here; the keybinding
 * service consults {@link isAnyOpen} as its single source of truth.
 */
type RaisedSurfaceKind = 'context-menu' | 'popover' | 'modal'

interface RaisedSurfaceEntry {
  id: symbol
  kind: RaisedSurfaceKind
}

export const useRaisedSurfaceStore = defineStore('raisedSurface', () => {
  const stack = ref<RaisedSurfaceEntry[]>([])
  const isAnyOpen = computed(() => stack.value.length > 0)

  function open(kind: RaisedSurfaceKind): symbol {
    const id = Symbol(kind)
    stack.value.push({ id, kind })
    return id
  }

  function close(id: symbol): void {
    const index = stack.value.findIndex((entry) => entry.id === id)
    if (index !== -1) stack.value.splice(index, 1)
  }

  return { stack, isAnyOpen, open, close }
})

/**
 * Bind a surface's reactive open-state to the raised-surface registry.
 *
 * @example
 * const isOpen = ref(false)
 * useRaisedSurface('context-menu', isOpen)
 */
export function useRaisedSurface(
  kind: RaisedSurfaceKind,
  isOpen: MaybeRefOrGetter<boolean>
): void {
  const store = useRaisedSurfaceStore()
  let id: symbol | null = null

  function release() {
    if (id !== null) {
      store.close(id)
      id = null
    }
  }

  watch(
    () => toValue(isOpen),
    (open) => {
      if (open && id === null) {
        id = store.open(kind)
      } else if (!open) {
        release()
      }
    },
    { immediate: true, flush: 'sync' }
  )

  onScopeDispose(release)
}
