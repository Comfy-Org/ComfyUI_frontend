export function createCancelToken() {
  let cancelled = false

  return {
    cancel: () => {
      cancelled = true
    },
    isCancelled: () => cancelled
  }
}
