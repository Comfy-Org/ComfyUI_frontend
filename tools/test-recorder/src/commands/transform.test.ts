import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it, vi } from 'vitest'

const tempDirs: string[] = []

describe('runTransform overwrite guard', () => {
  it('refuses to overwrite an existing output file without --force', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'comfy-transform-'))
    tempDirs.push(dir)
    const input = join(dir, 'demo.raw.spec.ts')
    const output = join(dir, 'demo.spec.ts')
    writeFileSync(input, "await page.getByText('Queue').click();\n")
    writeFileSync(output, '// existing committed spec\n')

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((
      code?: number
    ) => {
      throw new Error(`exit:${code}`)
    }) as never)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const { runTransform } = await import('./transform')
    await expect(runTransform(input, { output })).rejects.toThrow('exit:1')
    expect(readFileSync(output, 'utf-8')).toBe('// existing committed spec\n')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(logSpy.mock.calls.flat().join('\n')).toMatch(/Refusing to overwrite/)
  })

  it('overwrites when --force is set', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'comfy-transform-'))
    tempDirs.push(dir)
    const input = join(dir, 'demo.raw.spec.ts')
    const output = join(dir, 'demo.spec.ts')
    writeFileSync(input, "await page.getByText('Queue').click();\n")
    writeFileSync(output, '// existing committed spec\n')

    vi.spyOn(console, 'log').mockImplementation(() => {})
    // formatFile may fail outside the monorepo; that is fine for this guard test
    const { runTransform } = await import('./transform')
    await runTransform(input, { output, force: true, testName: 'demo' })
    expect(existsSync(output)).toBe(true)
    expect(readFileSync(output, 'utf-8')).not.toBe(
      '// existing committed spec\n'
    )
  })
})
