import * as fc from 'fast-check'

const OP_INGESTION_FUZZ_ITERATION_COUNT = 200

export const OP_INGESTION_FUZZ_CONFIG = {
  seed: 16_695,
  numRuns: OP_INGESTION_FUZZ_ITERATION_COUNT
}

/**
 * The malformed-slot domain both op-ingestion fuzz suites inject at their
 * boundaries: negative and non-integer numbers, numeric-looking strings, the
 * absent values, and non-scalars. It lives here with the seed and run bound so
 * a boundary added for one seam cannot silently go uncovered at the other.
 */
export const arbMalformedSlot = fc.oneof(
  fc.integer({ min: -1000, max: -1 }),
  fc
    .double({ noNaN: false, noDefaultInfinity: false })
    .filter((n) => !Number.isInteger(n)),
  fc.string(),
  fc.constant('0'),
  fc.constant(null),
  fc.constant(undefined),
  fc.boolean(),
  fc.constant([0]),
  fc.array(fc.integer(), { maxLength: 3 })
)
