import { useTimeout } from '@vueuse/core'
import { computed, ref } from 'vue'

/**
 * Vue boolean ref (writable computed) with one difference: when set to `true` it stays that way for at least {@link minDuration}.
 * If set to `false` before {@link minDuration} has passed, it uses a timer to delay the change.
 * @param value The default value to set on this ref
 * @param minDuration The minimum time that this ref must be `true` for
 * @returns A custom boolean vue ref with a minimum activation time
 */
export function useMinLoadingDurationRef(value: boolean, minDuration = 250) {
  const current = ref(value)

  const { ready, start } = useTimeout(minDuration, { controls: true })

  return computed({
    get: () => current.value || !ready.value,
    set: (newValue) => {
      if (newValue && !current.value) start()

      current.value = newValue
    }
  })
}
