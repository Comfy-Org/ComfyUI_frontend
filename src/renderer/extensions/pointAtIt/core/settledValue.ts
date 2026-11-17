interface SettledSource {
  read: () => string | null
  /** True while `read` may return a value that will not last. */
  isBusy: () => boolean
  /** Calls `changed` whenever `read` may return something new; returns its removal. */
  watch: (changed: () => void) => () => void
  settleMs: number
}

interface SettledValue {
  /** The last value that lasted; null until there is one. */
  current: () => string | null
  /** Calls `listener` after `current` has changed; returns its removal. */
  onChange: (listener: () => void) => () => void
}

/**
 * Follows a value that passes through throwaway states: a change counts
 * only once the source is no longer busy and the value has stayed for
 * `settleMs`. A value that comes back to what it was counts as no change.
 */
export function followSettled(source: SettledSource): SettledValue {
  let settled = source.isBusy() ? null : source.read()

  return {
    current: () => settled,
    onChange(listener) {
      let timer: ReturnType<typeof setTimeout> | undefined
      function wait(): void {
        clearTimeout(timer)
        timer = setTimeout(settle, source.settleMs)
      }
      function settle(): void {
        if (source.isBusy()) {
          wait()
          return
        }
        const value = source.read()
        if (value === settled) return
        settled = value
        listener()
      }
      const stopWatching = source.watch(wait)
      wait()
      return () => {
        stopWatching()
        clearTimeout(timer)
      }
    }
  }
}
