import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const EXISTING_SPEC = '// existing committed spec\n'

const originalArgv = process.argv

afterEach(() => {
  process.argv = originalArgv
  process.exitCode = undefined
})

async function runCli(...args: string[]) {
  process.argv = ['node', 'comfy-test', ...args]
  vi.resetModules()
  await import('./index')
}

describe('comfy-test transform --force', () => {
  it.for([
    {
      flags: ['--force'],
      expectedExitCode: undefined,
      expectedSaved: expect.stringContaining(
        "comfyPage.page.getByText('Queue').click()"
      )
    },
    {
      flags: ['--force=false'],
      expectedExitCode: 1,
      expectedSaved: EXISTING_SPEC
    },
    {
      flags: ['--force', 'false'],
      expectedExitCode: 1,
      expectedSaved: EXISTING_SPEC
    },
    { flags: [], expectedExitCode: 1, expectedSaved: EXISTING_SPEC }
  ])(
    '$flags exits with $expectedExitCode',
    async ({ flags, expectedExitCode, expectedSaved }) => {
      const dir = mkdtempSync(join(tmpdir(), 'comfy-cli-'))
      try {
        const input = join(dir, 'demo.raw.spec.ts')
        const output = join(dir, 'demo.spec.ts')
        writeFileSync(input, "await page.getByText('Queue').click();\n")
        writeFileSync(output, EXISTING_SPEC)
        vi.spyOn(process, 'exit').mockImplementation((code) => {
          throw new Error(`exit:${code}`)
        })
        vi.mocked(console.log).mockImplementation(() => {})

        await runCli('transform', input, '--output', output, ...flags)

        expect(process.exitCode).toBe(expectedExitCode)
        expect(readFileSync(output, 'utf-8')).toEqual(expectedSaved)
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    }
  )

  it.for(['--force=', '--force=1', '--force=yes', '--force=TRUE'])(
    'rejects malformed boolean flag %s',
    async (flag) => {
      const dir = mkdtempSync(join(tmpdir(), 'comfy-cli-'))
      try {
        const input = join(dir, 'demo.raw.spec.ts')
        const output = join(dir, 'demo.spec.ts')
        writeFileSync(input, "await page.getByText('Queue').click();\n")
        writeFileSync(output, EXISTING_SPEC)
        const logSpy = vi.mocked(console.log).mockImplementation(() => {})

        await runCli('transform', input, '--output', output, flag)

        expect(process.exitCode).toBe(1)
        expect(readFileSync(output, 'utf-8')).toBe(EXISTING_SPEC)
        expect(logSpy.mock.calls.flat().join('\n')).toMatch(
          /Invalid --force value/
        )
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    }
  )
})
