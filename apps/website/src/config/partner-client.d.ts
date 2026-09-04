/**
 * Type surface of the gitignored, LOCAL-ONLY partner bundle (src/vendor/ is
 * ignored wholesale) so `astro check` passes on a clean checkout that does
 * not have the .mjs on disk. See workshop-run-proxy.ts for what the bundle
 * is and why it exists.
 */
declare module '*/vendor/partner-client.mjs' {
  export function generate(
    config: {
      baseUrl: string
      token: string
      headers?: Record<string, string>
    },
    input: Record<string, unknown>
  ): Promise<{
    job_id?: string
    status?: string
    type?: string
    results?: ReadonlyArray<{ url?: string; mime?: string }>
  }>
}
