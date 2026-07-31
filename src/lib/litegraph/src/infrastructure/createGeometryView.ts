interface GeometryViewOptions {
  commit: () => void
  mapValue?: (property: PropertyKey, value: unknown) => unknown
  observe?: ArrayLike<number>
  synchronize?: () => void
}

export function createGeometryView<T extends object & ArrayLike<number>>(
  target: T,
  {
    synchronize,
    commit,
    observe = target,
    mapValue = (_property, value) => value
  }: GeometryViewOptions
): T {
  function commitIfChanged(previous: number[]): void {
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
