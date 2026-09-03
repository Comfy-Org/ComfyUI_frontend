// Using a template string for this is resulting in complex type workarounds. No current benefit beyond dev reading.
export type UUID = string

/** Special-case zero-UUID, consisting entirely of zeros. Used as a default value. */
export const zeroUuid = '00000000-0000-0000-0000-000000000000'

/** Pre-allocated storage for uuid random values. */
const randomStorage = new Uint32Array(31)

/** Thrown by {@link createUuidv4} when no Web Crypto implementation is available. */
export class UuidGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UuidGenerationError'
  }
}

/**
 * Creates a UUIDv4 string.
 * @returns A new UUIDv4 string
 * @throws {UuidGenerationError} When neither {@link crypto.randomUUID} nor
 * {@link crypto.getRandomValues} is available.
 * @remarks
 * Original implementation from https://gist.github.com/jed/982883?permalink_comment_id=852670#gistcomment-852670
 *
 * Prefers the {@link crypto.randomUUID} method if available, falling back to
 * {@link crypto.getRandomValues} for insecure contexts.
 */
export function createUuidv4(): UUID {
  const webCrypto = globalThis.crypto
  if (typeof webCrypto?.randomUUID === 'function') {
    return webCrypto.randomUUID()
  }
  if (typeof webCrypto?.getRandomValues === 'function') {
    const random = webCrypto.getRandomValues(randomStorage)
    let i = 0
    return '10000000-1000-4000-8000-100000000000'.replaceAll(/[018]/g, (a) =>
      (
        Number(a) ^
        ((random[i++] * 3.725_290_298_461_914e-9) >> (Number(a) * 0.25))
      ).toString(16)
    )
  }
  throw new UuidGenerationError('Web Crypto is required to generate a UUID')
}

/** Ensures an entity has a stable, non-zero UUID and returns it. */
export function ensureNonZeroUuid(entity: { id: UUID }): UUID {
  if (entity.id === zeroUuid) entity.id = createUuidv4()
  return entity.id
}
