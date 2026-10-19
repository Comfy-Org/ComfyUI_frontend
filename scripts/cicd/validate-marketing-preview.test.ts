import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, onTestFinished } from 'vitest'

import { validateMarketingPreview } from './validate-marketing-preview'

const sha = 'a'.repeat(40)

async function preview(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'marketing-preview-'))
  onTestFinished(() => rm(root, { recursive: true, force: true }))
  await writeFile(join(root, 'iframe.html'), '<html></html>')
  await writeFile(
    join(root, 'build-info.json'),
    JSON.stringify({ commit: sha })
  )
  return root
}

describe('marketing preview validation', () => {
  it('accepts a static catalog bound to the source commit', async () => {
    await expect(
      validateMarketingPreview(await preview(), sha)
    ).resolves.toBeUndefined()
  })

  it('rejects artifacts from another commit', async () => {
    await expect(
      validateMarketingPreview(await preview(), 'b'.repeat(40))
    ).rejects.toThrow('mismatch')
  })

  it.for([
    '_worker.js',
    '_headers',
    '_redirects',
    '_routes.json',
    'wrangler.jsonc',
    'functions'
  ])('rejects nested control files: %s', async (name) => {
    const root = await preview()
    await mkdir(join(root, 'nested'))
    await writeFile(join(root, 'nested', name), '')
    await expect(validateMarketingPreview(root, sha)).rejects.toThrow(
      'Forbidden'
    )
  })

  it('rejects symlinks before reading metadata', async () => {
    const root = await preview()
    await symlink(root, join(root, 'linked'), 'junction')
    await expect(validateMarketingPreview(root, sha)).rejects.toThrow(
      'Forbidden'
    )
  })
})
