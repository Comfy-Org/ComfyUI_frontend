import { computed, useAttrs } from 'vue'

import type { ClassValue } from 'clsx'

/**
 * Splits `class` out of `$attrs` so wrappers can merge it with `cn()` onto an
 * inner element while the remaining attrs fall through untouched.
 */
export function useAttrsClass() {
  const attrs = useAttrs()
  return {
    attrsClass: computed(() => attrs.class as ClassValue),
    attrsWithoutClass: computed(() => {
      const { class: _class, ...rest } = attrs
      return rest
    })
  }
}
