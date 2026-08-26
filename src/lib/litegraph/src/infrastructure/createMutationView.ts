interface MutationViewOptions {
  commit: () => void
  mapValue?: (property: PropertyKey, value: unknown) => unknown
  observe?: object
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

function snapshot(target: object): unknown[] {
  return Reflect.ownKeys(target).flatMap((property) => [
    property,
    Reflect.get(target, property)
  ])
}

export function createMutationView<TTarget extends object>(
  target: TTarget,
  {
    synchronize,
    commit,
    observe = target,
    mapValue = (_property, value) => value,
    shouldCommitMethod = () => true
  }: MutationViewOptions
): TTarget {
  function commitIfChanged(previous: unknown[]): void {
    const current = snapshot(observe)
    if (
      previous.some((value, index) => value !== current[index]) ||
      previous.length !== current.length
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
        const previous = snapshot(observe)
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
      const previous = snapshot(observe)
      try {
        return Reflect.set(target, property, value, target)
      } finally {
        commitIfChanged(previous)
      }
    },
    deleteProperty(target, property) {
      synchronize?.()
      const previous = snapshot(observe)
      try {
        return Reflect.deleteProperty(target, property)
      } finally {
        commitIfChanged(previous)
      }
    },
    defineProperty(target, property, attributes) {
      synchronize?.()
      const previous = snapshot(observe)
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
