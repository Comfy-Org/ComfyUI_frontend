/**
 * Whether a Cloudflare Access service token is available for the dev server to
 * forward. The proxy reads the same variables in `build/cloudflareAccess.ts`.
 */
export function hasAccessServiceToken(
  env: Record<string, string | undefined> = process.env
): boolean {
  return Boolean(
    env.DEV_SERVER_CF_ACCESS_CLIENT_ID && env.DEV_SERVER_CF_ACCESS_CLIENT_SECRET
  )
}
