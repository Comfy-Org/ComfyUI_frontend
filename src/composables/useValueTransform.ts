/**
 * Creates a getter/setter pair that transforms values on access if they have changed.
 * Does not observe deep changes.
 *
 * @example
 * const { get, set } = useValueTransform<ResultItem[], string[]>(
 *   items => items.map(formatPath)
 * )
 *
 * Object.defineProperty(obj, 'value', { get, set })
 */
export function useValueTransform<Internal, External>(
  transform: (value: Internal) => External,
  initialValue: Internal
) {
  let internalValue: Internal = initialValue
  let cachedValue: External = transform(initialValue)
  let isChanged = false

  return {
    get: () => {
      if (!isChanged) return cachedValue
      cachedValue = transform(internalValue)
      return cachedValue
    },
    set: (value: Internal) => {
      isChanged = true
      internalValue = value
    }
  }
}
