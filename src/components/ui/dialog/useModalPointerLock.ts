import { onScopeDispose, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

/**
 * Keeps the canvas behind a modal dialog inert by holding `document.body`'s
 * pointer-events lock for as long as at least one modal dialog is open.
 *
 * Reka-UI locks body pointer events per modal layer, but a nested dismissable
 * layer that is portalled to the body — e.g. a `Select` popover inside the
 * dialog — restores the body's pointer events when it closes, even while the
 * outer modal dialog is still open. That momentarily re-enables the canvas, so
 * combobox clicks leak through to it and can select a node or dismiss the
 * dialog. Reka still performs the initial lock and final restore; the
 * `MutationObserver` only re-asserts `none` if the lock is cleared while a
 * modal dialog is still open.
 */
let openModalCount = 0
let observer: MutationObserver | null = null

function enforceLock() {
  if (openModalCount > 0 && document.body.style.pointerEvents !== 'none') {
    document.body.style.pointerEvents = 'none'
  }
}

function acquire() {
  openModalCount += 1
  if (observer) return
  observer = new MutationObserver(enforceLock)
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['style']
  })
}

function release() {
  openModalCount = Math.max(0, openModalCount - 1)
  if (openModalCount > 0) return
  observer?.disconnect()
  observer = null
  document.body.style.pointerEvents = ''
}

export function useModalPointerLock(isOpen: MaybeRefOrGetter<boolean>) {
  let holding = false
  const sync = (open: boolean) => {
    if (open === holding) return
    holding = open
    if (open) acquire()
    else release()
  }
  watch(() => toValue(isOpen), sync, { immediate: true })
  onScopeDispose(() => sync(false))
}
