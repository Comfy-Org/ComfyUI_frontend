import type { InjectionKey, Ref, WritableComputedRef } from 'vue'
import { computed, inject, provide, ref } from 'vue'

const openPopoverKey: InjectionKey<Ref<string | null>> =
  Symbol('load3dOpenPopover')

/**
 * Keeps Load3D menubar popovers mutually exclusive. `@pointerdown.stop` on the
 * Load3D container blocks reka-ui's document-level outside-pointerdown
 * dismissal, so sibling popovers cannot close each other on their own — on
 * Safari not even via the focus-outside fallback, because clicking a button
 * there does not focus it.
 *
 * Call once per component; the returned factory yields a writable `open`
 * binding per popover id. The open-popover id is shared with ancestor scopes
 * via provide/inject, so exclusivity spans the whole menubar.
 */
export function usePopoverExclusivity() {
  const openPopover = inject(openPopoverKey, null) ?? ref<string | null>(null)
  provide(openPopoverKey, openPopover)
  return function exclusivePopover(id: string): WritableComputedRef<boolean> {
    return computed({
      get: () => openPopover.value === id,
      set: (open) => {
        if (open) openPopover.value = id
        else if (openPopover.value === id) openPopover.value = null
      }
    })
  }
}
