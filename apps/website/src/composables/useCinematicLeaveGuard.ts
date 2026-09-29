import { useEventListener } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'
import { ref, toValue } from 'vue'

import { linkLeavingPage } from '../lib/workshop/leaving-link'

/**
 * While takes render, leaving the page asks first: the browser's own prompt
 * for reloads and closes, and the site's dialog for links on the page.
 */
export function useCinematicLeaveGuard(
  active: MaybeRefOrGetter<boolean>,
  cancel: () => void
) {
  const leavingTo = ref<string>()

  useEventListener(
    () => (toValue(active) ? globalThis.window : undefined),
    'beforeunload',
    (event: BeforeUnloadEvent) => event.preventDefault()
  )

  useEventListener(
    () => (toValue(active) ? globalThis.document : undefined),
    'click',
    (event: MouseEvent) => {
      const href = linkLeavingPage(event, location)
      if (!href) return
      event.preventDefault()
      leavingTo.value = href
    },
    { capture: true }
  )

  function leave() {
    const href = leavingTo.value
    leavingTo.value = undefined
    if (!href) return
    cancel()
    location.assign(href)
  }

  function stay() {
    leavingTo.value = undefined
  }

  return { leavingTo, leave, stay }
}
