import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'

import { readConfig } from '../src/config.js'
import { main } from '../src/run.js'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

async function config(value: unknown): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'quality-config-'))
  directories.push(directory)
  const file = join(directory, 'config.json')
  await writeFile(file, JSON.stringify(value))
  return file
}

it('accepts explicit ESLint-only and hybrid consumer scopes', async () => {
  for (const lint of [
    { eslint: ['src'] },
    { eslint: ['src'], oxlint: ['src', '--type-aware'] }
  ]) {
    const value = {
      lint,
      format: { engine: 'prettier', args: ['.'] },
      audit: ['--quiet']
    }
    expect(await readConfig(await config(value))).toEqual(value)
  }
})

it.for([
  null,
  {},
  { lint: { eslint: [] }, format: { engine: 'oxfmt' } },
  { lint: { eslint: ['src'], oxlint: 'src' }, format: { engine: 'oxfmt' } },
  { lint: { eslint: ['src'] }, format: { engine: 'other' } }
])('rejects malformed configuration %j', async (value) => {
  await expect(readConfig(await config(value))).rejects.toThrow('Invalid')
})

it.for(['--help', '-h', 'help'])(
  'shows help without requiring configuration: %s',
  async (argument) => {
    const output = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    expect(await main([argument])).toBe(0)
    expect(output).toHaveBeenCalledWith(expect.stringContaining('--base'))
  }
)

it('rejects unknown commands and options before running a tool', async () => {
  await expect(main(['deploy'])).rejects.toThrow('Unknown command')
  await expect(main(['lint', '--unknown'])).rejects.toThrow('Unknown option')
  await expect(main(['format', '--fix'])).rejects.toThrow('Unknown option')
})
