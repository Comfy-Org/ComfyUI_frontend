import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'

const binary = resolve(import.meta.dirname, '../dist/cli.js')

it('runs the built formatter command and propagates failures', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'quality-cli-'))
  function run(args: string[]) {
    return spawnSync(process.execPath, [binary, ...args], {
      cwd,
      encoding: 'utf8'
    })
  }
  try {
    await writeFile(
      join(cwd, 'code-quality.config.json'),
      JSON.stringify({
        lint: { eslint: ['.'] },
        format: { engine: 'prettier', args: ['input.ts'] }
      })
    )
    await writeFile(join(cwd, 'input.ts'), 'export const name="hello"')
    expect(run(['format', '--check']).status).toBe(1)
    expect(run(['format']).status).toBe(0)
    expect(await readFile(join(cwd, 'input.ts'), 'utf8')).toBe(
      'export const name = "hello";\n'
    )
    expect(run(['format', '--check']).status).toBe(0)
    const unknown = run(['no-such-command'])
    expect(unknown.status).toBe(2)
    expect(unknown.stdout).toBe('')
    expect(unknown.stderr).toContain('Unknown command')
    expect(run(['--help']).status).toBe(0)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
})
