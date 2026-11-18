/**
 * Adds one registration of `listener`. The returned disposer removes only that
 * registration, even if the same function was added again, and reports
 * whether there was anything left to remove.
 */
export function addListener<TArgs extends unknown[]>(
  listeners: Set<(...args: TArgs) => void>,
  listener: (...args: TArgs) => void
): () => boolean {
  const registration = (...args: TArgs) => listener(...args)
  listeners.add(registration)
  return () => listeners.delete(registration)
}
