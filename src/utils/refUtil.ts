import { customRef } from 'vue'

type TimerId = Parameters<typeof clearTimeout>[0]

/**
 * This is a standard boolean vue ref with one difference: when set to `true` it stays that way for at least {@link duration}.
 * If set to `false` before {@link duration} has passed, it uses a timer to delay the change.
 * @param value The default value to set on this ref
 * @param duration The minimum time that this ref must be `true` for
 * @returns A custom boolean vue ref with a minimum activation time
 */
export function minDurationRef(value: boolean, duration = 250) {
  let enabledAt = Date.now()

  let timeout: TimerId

  return customRef((track, trigger) => ({
    get() {
      track()
      return value
    },
    set(newValue) {
      clearTimeout(timeout)

      if (newValue) {
        enabledAt = Date.now()
        value = newValue
        trigger()
      } else {
        const delay = Math.max(0, duration - (Date.now() - enabledAt))
        timeout = setTimeout(() => {
          value = newValue
          trigger()
        }, delay)
      }
    }
  }))
}
