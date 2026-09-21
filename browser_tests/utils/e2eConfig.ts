type E2EEnvironment = Readonly<Record<string, string | undefined>>

const defaultApiUrl = 'http://localhost:8188'
const localHostname =
  /^(?:localhost|\[::1\]|0\.0\.0\.0|127(?:\.\d{1,3}){3})$/

export function resolveSetupApiUrl(env: E2EEnvironment = process.env): string {
  return (
    env.PLAYWRIGHT_SETUP_API_URL ||
    env.PLAYWRIGHT_TEST_URL ||
    defaultApiUrl
  )
}

export function resolveSetupBackendUrl(
  env: E2EEnvironment = process.env
): string {
  const setupApiUrl = resolveSetupApiUrl(env)
  if (env.PLAYWRIGHT_SETUP_API_URL) return setupApiUrl

  return isLocalUrl(setupApiUrl) && env.DEV_SERVER_COMFYUI_URL
    ? env.DEV_SERVER_COMFYUI_URL
    : setupApiUrl
}

export function isLocalUrl(url: string): boolean {
  return localHostname.test(new URL(url).hostname)
}
