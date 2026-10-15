import { shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

/** `href` with `param` naming `key`, or without it for All. */
export function withChoice(href: string, param: string, key: string): string {
  const url = new URL(href)
  if (key === 'all') url.searchParams.delete(param)
  else url.searchParams.set(param, key)
  return url.href
}

/**
 * A sidebar choice kept in the address as `?<param>=` while `on`. A choice
 * the address names that is unknown or lists nothing opens as All.
 */
export function useAddressedChoice<K extends string>(
  param: string,
  known: readonly K[],
  on: Readonly<Ref<boolean>>,
  shown: (key: K) => boolean
) {
  const choice = shallowRef<K | 'all'>('all')

  function readAddress(search: string) {
    const named = new URLSearchParams(search).get(param)
    const found = known.find((key) => key === named)
    choice.value = found && shown(found) ? found : 'all'
  }

  watch(
    () => [choice.value, on.value] as const,
    ([key, active]) => {
      if (!active) return
      const next = withChoice(location.href, param, key)
      if (next !== location.href) history.replaceState(history.state, '', next)
    }
  )

  return { choice, readAddress }
}
