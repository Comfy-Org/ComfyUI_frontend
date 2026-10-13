import { execFileSync, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, matchesGlob } from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

const repoRoot = join(import.meta.dirname, '../..')
const workflow = z
  .object({
    on: z.object({ push: z.object({ paths: z.array(z.string()) }) }),
    jobs: z.record(
      z.string(),
      z.object({
        steps: z.array(
          z.object({ id: z.string().optional(), run: z.string().optional() })
        )
      })
    )
  })
  .parse(
    parse(
      readFileSync(
        join(repoRoot, '.github/workflows/i18n-update-website.yaml'),
        'utf8'
      )
    )
  )

function workflowScript(id: string): string {
  const script = workflow.jobs['update-locales'].steps.find(
    (step) => step.id === id
  )?.run
  if (!script) throw new Error(`Missing workflow script: ${id}`)
  return script
}

const englishCatalog = 'apps/website/src/locales/en/main.json'
const japaneseCatalog = 'apps/website/src/locales/ja/main.json'
const translationConfig = 'apps/website/src/config/translation.ts'

function translationFixture() {
  const root = mkdtempSync(join(tmpdir(), 'website-translation-workflow-'))
  const upstream = join(root, 'upstream')
  const checkout = join(root, 'checkout')
  const origin = join(root, 'origin.git')
  const bin = join(root, 'bin')
  const output = join(root, 'output')
  const gitEnv = {
    ...process.env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1'
  }

  function git(cwd: string, ...args: string[]) {
    return execFileSync('git', args, {
      cwd,
      env: gitEnv,
      encoding: 'utf8',
      stdio: 'pipe'
    })
  }

  function write(cwd: string, path: string, value: string) {
    const file = join(cwd, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, value)
  }

  mkdirSync(upstream)
  mkdirSync(bin)
  git(upstream, 'init', '--initial-branch=main')
  git(upstream, 'config', 'user.name', 'Test')
  git(upstream, 'config', 'user.email', 'test@example.com')
  write(upstream, englishCatalog, '{"hello":"Hello"}\n')
  write(upstream, japaneseCatalog, '{"hello":"こんにちは"}\n')
  write(upstream, translationConfig, 'export const model = "model-a"\n')
  const validator = 'scripts/cicd/check-json.sh'
  mkdirSync(dirname(join(upstream, validator)), { recursive: true })
  copyFileSync(join(repoRoot, validator), join(upstream, validator))
  git(upstream, 'add', '.')
  git(upstream, 'commit', '-m', 'Initial catalogs')
  git(root, 'clone', '--bare', upstream, origin)
  git(root, 'clone', origin, checkout)
  git(upstream, 'remote', 'add', 'origin', origin)
  writeFileSync(
    join(bin, 'gh'),
    `#!/bin/sh
set -eu
if [ "$FAKE_API_FAILURE" = 'true' ]; then
  echo 'service unavailable' >&2
  exit 1
fi
printf '%s' "$FAKE_PR_URL"
`,
    { mode: 0o755 }
  )

  return {
    advance(path: string, value: string) {
      write(upstream, path, value)
      git(upstream, 'add', '.')
      git(upstream, 'commit', '-m', 'Advance source')
      git(upstream, 'push', 'origin', 'main')
    },
    writeCatalog(value: string) {
      write(checkout, japaneseCatalog, value)
    },
    run(id: string, env: Record<string, string> = {}) {
      writeFileSync(output, '')
      const result = spawnSync('bash', ['-c', workflowScript(id)], {
        cwd: checkout,
        encoding: 'utf8',
        env: {
          ...gitEnv,
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          GITHUB_OUTPUT: output,
          GITHUB_REPOSITORY: 'Comfy-Org/ComfyUI_frontend',
          TARGET_BRANCH: 'main',
          TRANSLATION_BRANCH: 'bl/website-locale-updates',
          GH_TOKEN: 'test-token',
          FAKE_PR_URL: '',
          FAKE_API_FAILURE: 'false',
          ...env
        }
      })
      return { ...result, output: readFileSync(output, 'utf8') }
    },
    [Symbol.dispose]() {
      rmSync(root, { recursive: true, force: true })
    }
  }
}

describe('website translation automation', () => {
  it.for([
    { path: englishCatalog, expected: true },
    { path: translationConfig, expected: true },
    { path: japaneseCatalog, expected: false },
    { path: 'apps/website/src/locales/.source-manifest.json', expected: false }
  ])('triggers generation for $path: $expected', ({ path, expected }) => {
    expect(
      workflow.on.push.paths.some((pattern) => matchesGlob(path, pattern))
    ).toBe(expected)
  })

  it.for([
    { url: '', output: '' },
    { url: 'https://github.com/example/repo/pull/1', output: 'skip=true\n' }
  ])('skips generation only for an open PR: $url', ({ url, output }) => {
    using fixture = translationFixture()

    const result = fixture.run('pending', { FAKE_PR_URL: url })

    expect(result.status).toBe(0)
    expect(result.output).toBe(output)
  })

  it('stops before generation when the PR lookup fails', () => {
    using fixture = translationFixture()

    const result = fixture.run('pending', { FAKE_API_FAILURE: 'true' })

    expect(result.status).not.toBe(0)
    expect(result.output).toBe('')
  })

  it.for([
    { value: '{"hello":"こんにちは"}\n', status: 0, output: '' },
    { value: '{"hello":"ようこそ"}\n', status: 0, output: 'changed=true\n' },
    { value: '{', status: 1, output: '' }
  ])(
    'publishes only changed valid catalogs: $value',
    ({ value, status, output }) => {
      using fixture = translationFixture()
      fixture.writeCatalog(value)

      const result = fixture.run('locales')

      expect(result.status).toBe(status)
      expect(result.output).toBe(output)
    }
  )

  it('accepts output while the source branch is unchanged', () => {
    using fixture = translationFixture()

    expect(fixture.run('source').status).toBe(0)
  })

  it.for([
    { path: 'README.md', value: 'New documentation\n', status: 0 },
    { path: englishCatalog, value: '{"hello":"Welcome"}\n', status: 1 },
    { path: japaneseCatalog, value: '{"hello":"やあ"}\n', status: 1 },
    {
      path: translationConfig,
      value: 'export const model = "model-b"\n',
      status: 1
    },
    {
      path: 'scripts/i18n/config.ts',
      value: 'export const limit = 20\n',
      status: 1
    }
  ])(
    'rejects stale output after $path changes: $status',
    ({ path, value, status }) => {
      using fixture = translationFixture()
      fixture.advance(path, value)

      expect(fixture.run('source').status).toBe(status)
    }
  )
})
