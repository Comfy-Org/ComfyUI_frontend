/**
 * Finds the greatest common divisor (GCD) for two numbers.
 *
 * @param a - The first number.
 * @param b - The second number.
 * @returns The GCD of the two numbers.
 */
export const gcd = (a: number, b: number): number => {
  return b === 0 ? a : gcd(b, a % b)
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
