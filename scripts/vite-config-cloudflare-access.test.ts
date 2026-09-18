// @vitest-environment node
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { describe, expect, it } from 'vitest'

const execFileAsync = promisify(execFile)

// Written straight to the stream because the config's import graph decorates
// console output.
const PRINT_API_PROXY_HEADERS = `import('./vite.config.mts').then(({ default: config }) => {
  process.stdout.write(
    '<headers>' +
      JSON.stringify(config.server.proxy['/api'].headers ?? null) +
      '</headers>'
  )
})`

const PRINT_API_PROXY_SECURE = `import('./vite.config.mts').then(({ default: config }) => {
  process.stdout.write('<secure>' + String(config.server.proxy['/api'].secure) + '</secure>')
})`

async function apiProxyHeaders(
  serviceToken: Record<string, string>
): Promise<Record<string, string> | null> {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['--import', 'tsx', '--eval', PRINT_API_PROXY_HEADERS],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DEV_SERVER_COMFYUI_URL: 'https://nightly.example.com/',
        DEV_SERVER_CF_ACCESS_CLIENT_ID: '',
        DEV_SERVER_CF_ACCESS_CLIENT_SECRET: '',
        ...serviceToken
      }
    }
  )
  const printed = /<headers>(.*)<\/headers>/s.exec(stdout)
  if (!printed) throw new Error(`Config printed no headers: ${stdout}`)
  return JSON.parse(printed[1])
}

async function apiProxySecure(
  serviceToken: Record<string, string>
): Promise<boolean> {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['--import', 'tsx', '--eval', PRINT_API_PROXY_SECURE],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DEV_SERVER_COMFYUI_URL: 'https://nightly.example.com/',
        DISTRIBUTION: 'cloud',
        DEV_SERVER_CF_ACCESS_CLIENT_ID: '',
        DEV_SERVER_CF_ACCESS_CLIENT_SECRET: '',
        ...serviceToken
      }
    }
  )
  const printed = /<secure>(.*)<\/secure>/s.exec(stdout)
  if (!printed) throw new Error(`Config printed no secure value: ${stdout}`)
  return printed[1] === 'true'
}

describe('Cloudflare Access service token on the backend proxy', () => {
  it('forwards a configured service token to the backend', async () => {
    await expect(
      apiProxyHeaders({
        DEV_SERVER_CF_ACCESS_CLIENT_ID: 'client-id.access',
        DEV_SERVER_CF_ACCESS_CLIENT_SECRET: 'client-secret'
      })
    ).resolves.toEqual({
      'CF-Access-Client-Id': 'client-id.access',
      'CF-Access-Client-Secret': 'client-secret'
    })
  }, 60_000)

  it('sends no headers when no service token is configured', async () => {
    await expect(apiProxyHeaders({})).resolves.toBeNull()
  }, 60_000)

  it('refuses to expose an authenticated proxy through remote development', async () => {
    await expect(
      apiProxyHeaders({
        DEV_SERVER_CF_ACCESS_CLIENT_ID: 'client-id.access',
        DEV_SERVER_CF_ACCESS_CLIENT_SECRET: 'client-secret',
        VITE_REMOTE_DEV: 'true'
      })
    ).rejects.toThrow('cannot be used with VITE_REMOTE_DEV')
  }, 60_000)

  it('verifies backend TLS when forwarding a service token', async () => {
    await expect(
      apiProxySecure({
        DEV_SERVER_CF_ACCESS_CLIENT_ID: 'client-id.access',
        DEV_SERVER_CF_ACCESS_CLIENT_SECRET: 'client-secret'
      })
    ).resolves.toBe(true)
  }, 60_000)
})
