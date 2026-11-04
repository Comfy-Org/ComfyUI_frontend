import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const TRANSFORMED_ACTION = "comfyPage.page.getByText('Queue').click()"

function seedInput() {
  const dir = mkdtempSync(join(tmpdir(), 'comfy-transform-'))
  const input = join(dir, 'demo.raw.spec.ts')
  const output = join(dir, 'demo.spec.ts')
  writeFileSync(input, "await page.getByText('Queue').click();\n")
  return { dir, input, output }
}

describe('runTransform overwrite guard', () => {
  it('creates a new output file without --force', async () => {
    const { dir, input, output } = seedInput()
    try {
      vi.mocked(console.log).mockImplementation(() => {})
      const { runTransform } = await import('./transform')
      await runTransform(input, { output, testName: 'demo' })
      expect(readFileSync(output, 'utf-8')).toContain(TRANSFORMED_ACTION)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('refuses to overwrite an existing output file without --force', async () => {
    const { dir, input, output } = seedInput()
    try {
      writeFileSync(output, '// existing committed spec\n')

      vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`exit:${code}`)
      })
      const logSpy = vi.mocked(console.log).mockImplementation(() => {})

      const { runTransform } = await import('./transform')
      await expect(runTransform(input, { output })).rejects.toThrow('exit:1')
      expect(readFileSync(output, 'utf-8')).toBe('// existing committed spec\n')
      expect(logSpy.mock.calls.flat().join('\n')).toMatch(
        /Refusing to overwrite/
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  // existsSync reports a dangling link as absent and a plain write follows it,
  // so only exclusive creation refuses here — a check-then-write guard would
  // create the link's target.
  it('refuses a dangling symlink destination instead of writing through it', async () => {
    const { dir, input, output } = seedInput()
    try {
      const target = join(dir, 'elsewhere.spec.ts')
      symlinkSync(target, output)

      vi.spyOn(process, 'exit').mockImplementation((code) => {
        throw new Error(`exit:${code}`)
      })
      vi.mocked(console.log).mockImplementation(() => {})

      const { runTransform } = await import('./transform')
      await expect(runTransform(input, { output })).rejects.toThrow('exit:1')
      expect(existsSync(target)).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('overwrites when --force is set', async () => {
    const { dir, input, output } = seedInput()
    try {
      writeFileSync(output, '// existing committed spec\n')

      vi.mocked(console.log).mockImplementation(() => {})
      const { runTransform } = await import('./transform')
      await runTransform(input, { output, force: true, testName: 'demo' })
      expect(readFileSync(output, 'utf-8')).toContain(TRANSFORMED_ACTION)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
