import { v4 } from 'uuid'

/**
 * @deprecated Use `v4` from `uuid` directly. Kept as litegraph's public API
 * (`LiteGraph.uuidv4`, exported `createUuidv4`). uuid's v4 uses
 * crypto.getRandomValues, so it works in non-secure contexts (LAN HTTP) where
 * crypto.randomUUID() is unavailable.
 */
export const createUuidv4 = v4

// Using a template string for this is resulting in complex type workarounds. No current benefit beyond dev reading.
export type UUID = string

/** Special-case zero-UUID, consisting entirely of zeros. Used as a default value. */
export const zeroUuid = '00000000-0000-0000-0000-000000000000'
