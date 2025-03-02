/**
 * Creates a getter/setter pair that transforms values on access if they have changed.
 * Does not observe deep changes.
 *
 * @example
 * const transformFunction = (items: string[]) => items.map(item => `root/${item}.ext`)
 * const { get, set } = useValueTransform(transformFunction, [])
 * Object.defineProperty(obj, 'value', { get, set })
 *
 * obj.value = ['filename1', 'filename2']
 * console.log(obj.value) // ["root/filename1.ext", "root/filename2.ext"]
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
