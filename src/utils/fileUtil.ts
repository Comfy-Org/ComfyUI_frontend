/**
 * Reads a file (optionally capped to its first `maxBytes`) into an ArrayBuffer.
 * Resolves `null` when the read errors, aborts, or yields no result, so callers
 * can guard with a single truthiness check before parsing. The underlying
 * `FileReader` error reason is intentionally not surfaced; callers treat any
 * failure as "no metadata" rather than distinguishing causes.
 * @param file - The file to read.
 * @param maxBytes - Optional cap; when set, only the first `maxBytes` are read.
 */
export function readFileAsArrayBuffer(
  file: File,
  maxBytes?: number
): Promise<ArrayBuffer | null> {
  return new Promise<ArrayBuffer | null>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result instanceof ArrayBuffer ? reader.result : null)
    }
    reader.onerror = () => resolve(null)
    reader.onabort = () => resolve(null)
    const blob = maxBytes === undefined ? file : file.slice(0, maxBytes)
    reader.readAsArrayBuffer(blob)
  })
}
