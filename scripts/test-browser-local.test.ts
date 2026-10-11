import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

import { getPnpmInvocation } from './test-browser-local.utils'

const root = join(import.meta.dirname, '..')
const script = join(import.meta.dirname, 'test-browser-local.ts')

function runLauncher(
  testUrl?: string,
  forwardedArgs = ['widget.spec.ts', '--workers=1']
) {
  const fixture = mkdtempSync(join(tmpdir(), 'test-browser-local-'))
  const capture = join(fixture, 'capture.json')
  const pnpmEntry = join(fixture, 'pnpm.mjs')
  writeFileSync(
    pnpmEntry,
    `import { writeFileSync } from 'node:fs'
writeFileSync(process.env.CAPTURE, JSON.stringify({
  args: process.argv.slice(2),
  local: process.env.PLAYWRIGHT_LOCAL,
  url: process.env.PLAYWRIGHT_TEST_URL
}))
`
  )

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CAPTURE: capture,
    npm_execpath: pnpmEntry,
    PLAYWRIGHT_LOCAL: '1'
  }
  if (testUrl === undefined) delete env.PLAYWRIGHT_TEST_URL
  else env.PLAYWRIGHT_TEST_URL = testUrl

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', script, ...forwardedArgs],
    {
      cwd: root,
      env,
      encoding: 'utf8',
      timeout: 10_000
    }
  )

  try {
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    return JSON.parse(readFileSync(capture, 'utf8')) as {
      args: string[]
      local: string
      url: string
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
}

describe('local browser test launcher', () => {
  it('runs pnpm through Node without a shell', () => {
    expect(getPnpmInvocation(['test:browser', 'spec.ts'], '/pnpm.mjs')).toEqual(
      {
        command: process.execPath,
        args: ['/pnpm.mjs', 'test:browser', 'spec.ts']
      }
    )
  })

  it('preserves an explicit frontend URL and forwards arguments', () => {
    expect(runLauncher('http://127.0.0.1:6201')).toEqual({
      args: ['test:browser', 'widget.spec.ts', '--workers=1'],
      local: '1',
      url: 'http://127.0.0.1:6201'
    })
  })

  it('preserves percent expressions and embedded shell metacharacters', () => {
    expect(
      runLauncher('http://127.0.0.1:6201', ['%OS%', 'a" & b', 'x|y'])
    ).toEqual({
      args: ['test:browser', '%OS%', 'a" & b', 'x|y'],
      local: '1',
      url: 'http://127.0.0.1:6201'
    })
  })

  it('defaults the frontend URL when the caller omits it', () => {
    expect(runLauncher()).toEqual({
      args: ['test:browser', 'widget.spec.ts', '--workers=1'],
      local: '1',
      url: 'http://localhost:5173'
    })
  })

  it.for(['', '   '])(
    'defaults the frontend URL when the caller provides %j',
    (testUrl) => {
      expect(runLauncher(testUrl)).toEqual({
        args: ['test:browser', 'widget.spec.ts', '--workers=1'],
        local: '1',
        url: 'http://localhost:5173'
      })
    }
  )
})
