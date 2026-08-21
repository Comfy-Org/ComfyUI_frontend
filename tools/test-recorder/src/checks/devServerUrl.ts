const DEFAULT_DEV_PORT = 5173

export function devServerPort(): number {
  return Number(process.env.COMFY_TEST_DEV_PORT) || DEFAULT_DEV_PORT
}

/**
 * Shared by the check and the recorder so a passing check cannot point
 * somewhere the recording does not.
 */
export function devServerUrl(): string {
  return (
    process.env.PLAYWRIGHT_TEST_URL ?? `http://localhost:${devServerPort()}`
  )
}
