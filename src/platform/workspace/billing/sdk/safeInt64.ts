/**
 * The generated zod schemas coerce every int64 to `bigint` and accept the
 * whole signed range, while the generated types the host reads through say
 * `number`. `Number()` on a value past 2^53 rounds silently, so a value the
 * host cannot hold exactly is refused rather than reshaped: the read then
 * fails as malformed, the way a body the core cannot decode does.
 */
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER)

export function asSafeNumber(value: bigint): number | undefined {
  return value >= -MAX_SAFE && value <= MAX_SAFE ? Number(value) : undefined
}
