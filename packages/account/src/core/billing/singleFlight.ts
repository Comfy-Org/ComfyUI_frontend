export function createSingleFlight() {
  const active = new Map<string, Promise<unknown>>()
  return function singleFlight<T>(
    kind: 'subscribe' | 'topup',
    task: () => Promise<T>
  ): Promise<T> {
    const existing = active.get(kind)
    if (existing) return existing as Promise<T>
    const current = task().finally(() => active.delete(kind))
    active.set(kind, current)
    return current
  }
}
