const DEFAULT_DEV_PORT = 5173

export function devServerPort(): number {
  const configured = Number(process.env.COMFY_TEST_DEV_PORT)
  const usable =
    Number.isInteger(configured) && configured > 0 && configured <= 65535
  return usable ? configured : DEFAULT_DEV_PORT
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
