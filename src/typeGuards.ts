import { IColorable } from "@/interfaces"

/**
 * Checks if an object is an instance of {@link IColorable}.
 */
export const isColorable = (obj: unknown): obj is IColorable => {
  return typeof obj === "object" && obj !== null && "setColorOption" in obj && "getColorOption" in obj
}
