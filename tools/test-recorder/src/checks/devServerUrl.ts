const DEFAULT_DEV_PORT = 5173

export function devServerPort(): number {
  return Number(process.env.COMFY_TEST_DEV_PORT) || DEFAULT_DEV_PORT
}

/**
 * Single source of truth for the URL both the environment check and the
 * recorder use, so a passing check can never point somewhere the recording
 * does not.
 */
export function devServerUrl(): string {
  return (
    process.env.PLAYWRIGHT_TEST_URL ?? `http://localhost:${devServerPort()}`
  )
}
