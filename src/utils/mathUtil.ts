import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import type { Bounds } from '@/renderer/core/layout/types'

/**
 * Finds the greatest common divisor (GCD) for two numbers using iterative
 * Euclidean algorithm. Uses iteration instead of recursion to avoid stack
 * overflow with large inputs or small floating-point step values.
 *
 * For floating-point numbers, uses a tolerance-based approach to handle
 * precision issues and limits iterations to prevent hangs.
 *
 * @param a - The first number.
 * @param b - The second number.
 * @returns The GCD of the two numbers.
 */
export const gcd = (a: number, b: number): number => {
  // Use absolute values to handle negative numbers
  let x = Math.abs(a)
  let y = Math.abs(b)

  // Handle edge cases
  if (x === 0) return y
  if (y === 0) return x

  // For floating-point numbers, use tolerance-based comparison
  // This prevents infinite loops due to floating-point precision issues
  const epsilon = 1e-10
  const maxIterations = 100

  let iterations = 0
  while (y > epsilon && iterations < maxIterations) {
    ;[x, y] = [y, x % y]
    iterations++
  }

  return x
}

/**
 * Finds the least common multiple (LCM) for two numbers.
 *
 * @param a - The first number.
 * @param b - The second number.
 * @returns The LCM of the two numbers.
 */
export const lcm = (a: number, b: number): number => {
  return Math.abs(a * b) / gcd(a, b)
}

/**
 * Computes the union (bounding box) of multiple rectangles using a single-pass algorithm.
 *
 * Finds the minimum and maximum x/y coordinates across all rectangles to create
 * a single bounding rectangle that contains all input rectangles. Optimized for
 * performance with V8-friendly tuple access patterns.
 *
 * @param rectangles - Array of rectangle tuples in [x, y, width, height] format
 * @returns Bounds object with union rectangle, or null if no rectangles provided
 */
export function computeUnionBounds(
  rectangles: readonly ReadOnlyRect[]
): Bounds | null {
  const n = rectangles.length
  if (n === 0) {
    return null
  }

  const r0 = rectangles[0]
  let minX = r0[0]
  let minY = r0[1]
  let maxX = minX + r0[2]
  let maxY = minY + r0[3]

  for (let i = 1; i < n; i++) {
    const r = rectangles[i]
    const x1 = r[0]
    const y1 = r[1]
    const x2 = x1 + r[2]
    const y2 = y1 + r[3]

    if (x1 < minX) minX = x1
    if (y1 < minY) minY = y1
    if (x2 > maxX) maxX = x2
    if (y2 > maxY) maxY = y2
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}
