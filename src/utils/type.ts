import type { IColorable } from "@/interfaces"

/**
 * Converts a plain object to a class instance if it is not already an instance of the class.
 * @param cls The class to convert to
 * @param obj The object to convert
 * @returns The class instance
 */
export function toClass<P, C>(cls: new (plain: P) => C, obj: P | C): C {
  return obj instanceof cls ? obj : new cls(obj as P)
}

/**
 * Checks if an object is an instance of {@link IColorable}.
 */
export function isColorable(obj: unknown): obj is IColorable {
  return typeof obj === "object" && obj !== null && "setColorOption" in obj && "getColorOption" in obj
}
