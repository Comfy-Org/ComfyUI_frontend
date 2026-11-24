// fetchApi aborts a request whose response has not started by its timeout, and
// an upload's response only starts after its whole body is sent. A fixed
// timeout therefore caps the file size by the user's upstream speed (120 s at
// 10 Mbit/s is about 150 MB, Comfy Cloud's image cap). Size it from a floor
// throughput instead.
const UPLOAD_BASE_TIMEOUT_MS = 120_000
const UPLOAD_FLOOR_BYTES_PER_SECOND = 256 * 1024

export function uploadTimeoutMs(sizeBytes: number): number {
  return (
    UPLOAD_BASE_TIMEOUT_MS +
    Math.ceil((sizeBytes / UPLOAD_FLOOR_BYTES_PER_SECOND) * 1000)
  )
}
