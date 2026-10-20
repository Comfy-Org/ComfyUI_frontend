import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { describe, expect, it, onTestFinished } from 'vitest'
import { isMap, isSeq, parseDocument } from 'yaml'

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

  it('reports a missing catalog iframe', async () => {
    const root = await preview()
    await rm(join(root, 'iframe.html'))
    await expect(validateMarketingPreview(root, sha)).rejects.toThrow(
      'Missing catalog iframe'
    )
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

function freshnessScript(): string {
  const root = dirname(dirname(import.meta.dirname))
  const workflow = parseDocument(
    readFileSync(
      join(root, '.github/workflows/pr-marketing-storybook-preview.yaml'),
      'utf8'
    )
  )
  const steps = workflow.getIn(['jobs', 'preview', 'steps'])
  if (!isSeq(steps)) throw new Error('Missing deployment steps')
  const step = steps.items.find(
    (value) => isMap(value) && value.get('id') === 'freshness'
  )
  if (!isMap(step)) throw new Error('Missing freshness step')
  const script = step.get('run')
  if (typeof script !== 'string') throw new Error('Missing freshness script')
  return script
}

describe('marketing push freshness', () => {
  it.for([true, false])(
    'handles current=%s without failing deployment verification',
    async (current) => {
      const root = await preview()
      execFileSync('git', ['init', '--quiet', root])
      execFileSync('git', [
        '-C',
        root,
        '-c',
        'user.name=Preview',
        '-c',
        'user.email=preview@example.test',
        'commit',
        '--quiet',
        '--allow-empty',
        '-m',
        'Fixture'
      ])
      const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
        encoding: 'utf8'
      }).trim()
      const output = join(root, 'output')
      await writeFile(output, '')
      execFileSync('bash', ['-e', '-c', freshnessScript()], {
        cwd: root,
        env: {
          ...process.env,
          SOURCE_SHA: current ? head : '0'.repeat(40),
          GITHUB_OUTPUT: output
        }
      })
      expect(readFileSync(output, 'utf8')).toBe(current ? '' : 'skip=true\n')
    }
  )
})
