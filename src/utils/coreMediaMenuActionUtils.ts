export type CoreMediaMenuActionKind = 'input' | 'preview'

const coreMediaMenuActionKinds = new WeakMap<object, CoreMediaMenuActionKind>()

export function markCoreMediaMenuCallback<T extends object>(
  callback: T,
  kind: CoreMediaMenuActionKind
): T {
  coreMediaMenuActionKinds.set(callback, kind)
  return callback
}

export function filterUnavailableCoreMediaMenuActions<T>(
  options: readonly T[],
  unavailableKinds: ReadonlySet<CoreMediaMenuActionKind>
): T[] {
  return options.filter((option) => {
    if (!option || typeof option !== 'object' || !('callback' in option))
      return true

    const { callback } = option
    if (typeof callback !== 'function') return true

    const kind = coreMediaMenuActionKinds.get(callback)
    return !kind || !unavailableKinds.has(kind)
  })
}
