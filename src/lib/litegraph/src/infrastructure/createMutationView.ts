interface MutationViewOptions<TValue> {
  commit: () => void
  mapValue?: (property: PropertyKey, value: unknown) => unknown
  observe?: ArrayLike<TValue>
  shouldCommitMethod?: (property: PropertyKey) => boolean
  synchronize?: () => void
}

const arrayMutationMethods = new Set<PropertyKey>([
  'copyWithin',
  'fill',
  'pop',
  'push',
  'reverse',
  'shift',
  'sort',
  'splice',
  'unshift'
])

export function createMutationView<
  TValue,
  TTarget extends object & ArrayLike<TValue>
>(
  target: TTarget,
  {
    synchronize,
    commit,
    observe = target,
    mapValue = (_property, value) => value,
    shouldCommitMethod = () => true
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
      if (!shouldCommitMethod(property)) return value.bind(target)

      return (...args: unknown[]) => {
        synchronize?.()
        const previous = Array.from(observe)
        try {
          const result = Reflect.apply(value, target, args)
          return result === target ? receiver : result
        } finally {
          commitIfChanged(previous)
        }
      }
    },
    set(target, property, value) {
      synchronize?.()
      const previous = Array.from(observe)
      try {
        return Reflect.set(target, property, value, target)
      } finally {
        commitIfChanged(previous)
      }
    },
    deleteProperty(target, property) {
      synchronize?.()
      const previous = Array.from(observe)
      try {
        return Reflect.deleteProperty(target, property)
      } finally {
        commitIfChanged(previous)
      }
    },
    defineProperty(target, property, attributes) {
      synchronize?.()
      const previous = Array.from(observe)
      try {
        return Reflect.defineProperty(target, property, attributes)
      } finally {
        commitIfChanged(previous)
      }
    }
  })
}

export function createArrayMutationView<TValue>(
  target: TValue[],
  commit: () => void,
  synchronize?: () => void
): TValue[] {
  return createMutationView(target, {
    commit,
    synchronize,
    shouldCommitMethod: (property) => arrayMutationMethods.has(property)
  })
}
