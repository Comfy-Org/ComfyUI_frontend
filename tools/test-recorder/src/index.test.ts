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
    { flags: ['--force'], replaced: true },
    { flags: ['--force=false'], replaced: false },
    { flags: ['--force', 'false'], replaced: false },
    { flags: [], replaced: false }
  ])('$flags replaced the spec: $replaced', async ({ flags, replaced }) => {
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

      const saved = readFileSync(output, 'utf-8')
      if (replaced) {
        expect(process.exitCode).toBeUndefined()
        expect(saved).toContain("comfyPage.page.getByText('Queue').click()")
      } else {
        expect(process.exitCode).toBe(1)
        expect(saved).toBe(EXISTING_SPEC)
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
