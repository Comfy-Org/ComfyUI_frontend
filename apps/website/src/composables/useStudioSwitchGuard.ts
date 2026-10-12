import type { InjectionKey } from 'vue'
import { inject, onScopeDispose, provide, shallowRef } from 'vue'

type Busy = () => boolean

const REGISTER: InjectionKey<(busy: Busy) => void> = Symbol('studio-switch')

/**
 * The review switcher swaps whole studio layouts, and unmounting one cancels
 * its run. The mounted layout reports whether it is rendering so the switcher
 * can ask before throwing a paid run away.
 */
export function provideStudioSwitchGuard(): Busy {
  const current = shallowRef<Busy>()
  provide(REGISTER, (busy) => {
    current.value = busy
    onScopeDispose(() => {
      if (current.value === busy) current.value = undefined
    })
  })
  return () => current.value?.() ?? false
}

export function reportStudioBusy(busy: Busy) {
  inject(REGISTER, undefined)?.(busy)
}
