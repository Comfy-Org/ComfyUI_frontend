interface MutationViewOptions<TValue> {
  commit: () => void
  mapValue?: (property: PropertyKey, value: unknown) => unknown
  observe?: ArrayLike<TValue>
  synchronize?: () => void
}

export function createMutationView<
  TValue,
  TTarget extends object & ArrayLike<TValue>
>(
  target: TTarget,
  {
    synchronize,
    commit,
    observe = target,
    mapValue = (_property, value) => value
  }: MutationViewOptions<TValue>
): TTarget {
  function commitIfChanged(previous: TValue[]): void {
    if (
      previous.some((value, index) => value !== observe[index]) ||
      previous.length !== observe.length
    )
      commit()
  }

  return new Proxy(target, {
    get(target, property, receiver) {
      synchronize?.()
      const value = mapValue(property, Reflect.get(target, property, target))
      if (property === 'constructor') return value
      if (typeof value !== 'function') return value

      return (...args: unknown[]) => {
        synchronize?.()
        const previous = Array.from(observe)
        const result = Reflect.apply(value, target, args)
        commitIfChanged(previous)
        return result === target ? receiver : result
      }
    },
    set(target, property, value) {
      synchronize?.()
      const previous = Array.from(observe)
      const updated = Reflect.set(target, property, value, target)
      commitIfChanged(previous)
      return updated
    }
  })
}
