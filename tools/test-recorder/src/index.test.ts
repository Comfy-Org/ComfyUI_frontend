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

/** Runs the real CLI entry point, which dispatches on `process.argv` at import. */
async function runCli(...args: string[]) {
  process.argv = ['node', 'comfy-test', ...args]
  vi.resetModules()
  await import('./index')
}

// Overwrite consent comes from how the entry point reads --force, so these go
// through it rather than handing runTransform a boolean.
describe('comfy-test transform --force', () => {
  it.for([
    { flag: '--force', replaced: true },
    { flag: '--force=false', replaced: false }
  ])('$flag replaced the spec: $replaced', async ({ flag, replaced }) => {
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

      await runCli('transform', input, '--output', output, flag)

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
