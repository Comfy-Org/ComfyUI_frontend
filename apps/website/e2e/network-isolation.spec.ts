import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test('network isolation rejects unexpected traffic and route bypasses', async ({
  baseURL
}) => {
  const directory = await mkdtemp(join(tmpdir(), 'website-network-'))
  const fixture = fileURLToPath(
    new URL('./fixtures/blockExternalMedia.ts', import.meta.url)
  )
  try {
    await writeFile(join(directory, 'package.json'), '{"type":"module"}')
    await writeFile(
      join(directory, 'playwright.config.ts'),
      `export default {
        testDir: '.',
        workers: 1,
        retries: 0,
        timeout: 5000,
        reporter: 'list',
        use: { baseURL: ${JSON.stringify(baseURL)} }
      }`
    )
    await writeFile(
      join(directory, 'network.spec.ts'),
      `import { test } from ${JSON.stringify(fixture)}

      test('navigation', async ({ page }) => {
        await page.goto('https://unexpected.invalid/navigation').catch(() => {})
      })

      test('popup', async ({ page, context }) => {
        const blocked = context.waitForEvent('requestfailed')
        await page.evaluate(() => window.open('https://unexpected.invalid/popup'))
        await blocked
      })

      test('websocket', async ({ page }) => {
        await page.evaluate(() => new Promise(resolve => {
          const socket = new WebSocket('wss://unexpected.invalid/socket')
          socket.onclose = resolve
        }))
      })

      test('route bypass', async ({ page, context }) => {
        await context.route('http://unexpected.invalid/bypass', route => route.continue())
        const response = await page.goto('http://unexpected.invalid/bypass')
        if (response?.status() !== 502) throw new Error('Deny proxy was bypassed')
      })`
    )
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(import.meta.resolve('@playwright/test/cli')),
        'test',
        '--config',
        join(directory, 'playwright.config.ts')
      ],
      {
        cwd: directory,
        encoding: 'utf8',
        timeout: 20_000,
        env: { ...process.env, FORCE_COLOR: '0' }
      }
    )
    expect(result.error).toBeUndefined()
    expect(result.status, result.stdout + result.stderr).toBe(1)
    expect(result.stdout).toContain('3 failed')
    expect(result.stdout).toContain('1 passed')
    expect(
      result.stdout.match(/Error: Unexpected external requests/g)
    ).toHaveLength(3)
    for (const path of ['navigation', 'popup', 'socket']) {
      expect(result.stdout).toContain(`unexpected.invalid/${path}`)
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
