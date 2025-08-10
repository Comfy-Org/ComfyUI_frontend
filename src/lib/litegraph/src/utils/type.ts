import type { IColorable } from '@/lib/litegraph/src/interfaces'

/**
 * Converts a plain object to a class instance if it is not already an instance of the class.
 *
 * Requires specific constructor signature; first parameter must be the object to convert.
 * @param cls The class to convert to
 * @param args The object to convert, followed by any other constructor arguments
 * @returns The class instance
 */
export function toClass<P, C extends P, Args extends unknown[]>(
  cls: new (instance: P, ...args: Args) => C,
  ...args: [P, ...Args]
): C {
  return args[0] instanceof cls ? args[0] : new cls(...args)
}

/**
 * Checks if an object is an instance of {@link IColorable}.
 */
export function isColorable(obj: unknown): obj is IColorable {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'setColorOption' in obj &&
    'getColorOption' in obj
  )
}
