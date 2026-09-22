type E2EEnvironment = Readonly<Record<string, string | undefined>>

const defaultApiUrl = 'http://localhost:8188'
const localHostname = /^(?:localhost|\[::1\]|0\.0\.0\.0|127(?:\.\d{1,3}){3})$/

export function resolveSetupApiUrl(env: E2EEnvironment = process.env): string {
  const apiUrl =
    env.PLAYWRIGHT_SETUP_API_URL || env.PLAYWRIGHT_TEST_URL || defaultApiUrl
  return apiUrl.replace(/\/+$/, '')
}

export function resolveLocalSetupApiUrl(
  env: E2EEnvironment = process.env
): string | undefined {
  const setupApiUrl = resolveSetupApiUrl(env)
  return localHostname.test(new URL(setupApiUrl).hostname)
    ? setupApiUrl
    : undefined
}
