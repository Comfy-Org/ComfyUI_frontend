import { execFileSync, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { assert, describe, expect, it, onTestFinished } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

const script = resolve('scripts/cicd/catalog-delivery-gate.ts')
const tsx = resolve('node_modules/tsx/dist/cli.mjs')
const app = 'export const localeDefinitions = { en: {}, ja: {}, zh: {} }'
const website = `export const LOCALES = { en: {}, 'zh-CN': {}, ja: {} }
const PARTIAL_LOCALE_ROUTES = { ja: new Set(['/']) }`

function repository() {
  const root = mkdtempSync(join(tmpdir(), 'catalog-delivery-'))
  onTestFinished(() => rmSync(root, { recursive: true, force: true }))
  function write(path: string, content: string) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  function git(...args: string[]) {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
  }
  git('init', '-q')
  git('config', 'user.name', 'Fixture')
  git('config', 'user.email', 'fixture@example.com')
  write('package.json', '{"version":"1.0.0"}')
  write('src/locales/localeConfig.ts', app)
  write('apps/website/src/config/locales.ts', website)
  git('add', '.')
  git('commit', '-qm', 'Base')
  const base = git('rev-parse', 'HEAD')
  const bin = join(root, '.bin')
  mkdirSync(bin)
  writeFileSync(
    join(bin, 'pnpm'),
    '#!/bin/sh\nif [ "$1" = "locale:delivery" ]; then exec "$CATALOG_NODE" "$CATALOG_TSX" "$CATALOG_SCRIPT"; fi\nprintf "%s\\n" "$@" >> "$CATALOG_ARGS_FILE"\nexit "$CATALOG_EXIT_STATUS"\n',
    { mode: 0o755 }
  )
  const argsFile = join(root, 'args.txt')
  return {
    base,
    write,
    git,
    run(event?: object, failure = '0', command?: string) {
      const eventPath = join(root, 'event.json')
      if (event) writeFileSync(eventPath, JSON.stringify(event))
      const result = spawnSync(
        command ? 'bash' : process.execPath,
        command
          ? ['-c', command]
          : event
            ? [tsx, script]
            : [tsx, script, '--base', base],
        {
          cwd: root,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${bin}:${process.env.PATH}`,
            GITHUB_REPOSITORY: 'Comfy-Org/ComfyUI_frontend',
            GITHUB_EVENT_PATH: event ? eventPath : '',
            CATALOG_ARGS_FILE: argsFile,
            CATALOG_EXIT_STATUS: failure,
            CATALOG_NODE: process.execPath,
            CATALOG_TSX: tsx,
            CATALOG_SCRIPT: script
          }
        }
      )
      return {
        status: result.status,
        output: result.stdout + result.stderr,
        args: existsSync(argsFile) ? readFileSync(argsFile, 'utf8') : ''
      }
    }
  }
}

describe('catalog delivery command', () => {
  it('runs delivery readiness from the shared PR and queue action', () => {
    const action = z
      .object({
        runs: z.object({
          steps: z.array(z.object({ run: z.string().optional() }))
        })
      })
      .parse(
        parse(readFileSync('.github/actions/repo-checks/action.yml', 'utf8'))
      )
    const gate = action.runs.steps.find((step) =>
      step.run?.includes('locale:delivery')
    )
    assert.exists(gate?.run)
    const repo = repository()
    repo.write('package.json', '{"version":"1.1.0"}')
    const result = repo.run(
      { merge_group: { base_sha: repo.base } },
      '0',
      gate.run
    )
    expect(result.status).toBe(0)
    expect(result.args).toBe(
      'locale:check\n--target=app\n--complete\n--locales=ja,zh\n'
    )
  })

  it.for(['core', 'nodes'])(
    'validates all generated outputs in the %s workflow',
    (name) => {
      const workflow = z
        .object({
          jobs: z.object({
            'update-locales': z.object({
              steps: z.array(z.object({ run: z.string().optional() }))
            })
          })
        })
        .parse(
          parse(
            readFileSync(`.github/workflows/i18n-update-${name}.yaml`, 'utf8')
          )
        )
      const check = workflow.jobs['update-locales'].steps.find((step) =>
        step.run?.includes('locale:check --complete')
      )
      assert.exists(check?.run)
      const repo = repository()
      const result = repo.run(undefined, '0', check.run)
      expect(result.status).toBe(0)
      expect(result.args).toBe('locale:check\n--complete\n')
    }
  )

  it('permits pending ordinary English copy without invoking completeness', () => {
    const repo = repository()
    repo.write('apps/website/src/locales/en/main.json', '{"new":"English"}')
    repo.git('add', 'apps/website/src/locales/en/main.json')
    const result = repo.run()
    expect(result.status).toBe(0)
    expect(result.args).toBe('')
    expect(result.output).toContain('English fallback')
  })

  it('does not mistake newer base-branch versions for a feature release', () => {
    const repo = repository()
    repo.git('branch', 'feature', repo.base)
    repo.write('package.json', '{"version":"1.1.0"}')
    repo.git('add', 'package.json')
    repo.git('commit', '-qm', 'Other release')
    const newerBase = repo.git('rev-parse', 'HEAD')
    repo.git('checkout', '-q', 'feature')
    repo.write('apps/website/src/locales/en/main.json', '{"new":"English"}')
    repo.git('add', 'apps/website/src/locales/en/main.json')
    repo.git('commit', '-qm', 'English feature')
    const result = repo.run({
      pull_request: {
        base: { sha: newerBase },
        head: {
          ref: 'feature',
          repo: { full_name: 'Comfy-Org/ComfyUI_frontend' }
        }
      }
    })
    expect(result.status).toBe(0)
    expect(result.args).toBe('')
  })

  it('enforces combined generation and release scopes in the merge queue', () => {
    const repo = repository()
    repo.write('package.json', '{"version":"1.1.0"}')
    repo.write('apps/website/src/locales/.source-manifest.json', '{}')
    repo.git(
      'add',
      'package.json',
      'apps/website/src/locales/.source-manifest.json'
    )
    repo.git('commit', '-qm', 'Delivery')
    const result = repo.run({ merge_group: { base_sha: repo.base } })
    expect(result.status).toBe(0)
    expect(result.args).toBe(
      'locale:check\n--target=app\n--complete\n--locales=ja,zh\n' +
        'locale:check\n--target=website\n--complete\n--locales=zh-CN,ja\n'
    )
  })

  it('checks every output locale for a generated app manifest', () => {
    const repo = repository()
    repo.write('src/locales/.source-manifest.json', '{}')
    repo.git('add', 'src/locales/.source-manifest.json')
    const result = repo.run()
    expect(result.status).toBe(0)
    expect(result.args).toBe('locale:check\n--target=app\n--complete\n')
  })

  it('propagates failed strict validation rather than claiming success', () => {
    const repo = repository()
    repo.write('package.json', '{"version":"1.1.0"}')
    const result = repo.run(undefined, '7')
    expect(result.status).toBe(1)
    expect(result.args).toContain('--complete\n--locales=ja,zh\n')
  })

  it('requires launched locale coverage with no manifest or version change', () => {
    const repo = repository()
    repo.write('apps/website/src/pages/ja/クラウド.astro', '<h1>Cloud</h1>')
    repo.git('add', 'apps/website/src/pages/ja/クラウド.astro')
    const result = repo.run()
    expect(result.status).toBe(0)
    expect(result.args).toBe(
      'locale:check\n--target=website\n--complete\n--locales=ja\n'
    )
  })

  it.for([
    {
      name: 'same-repository generation branch',
      repository: 'Comfy-Org/ComfyUI_frontend',
      expected:
        'locale:check\n--target=website\n--complete\n--locales=zh-CN,ja\n'
    },
    {
      name: 'fork with a matching branch name',
      repository: 'fork/frontend',
      expected: ''
    }
  ])('recognizes $name', ({ repository: full_name, expected }) => {
    const repo = repository()
    const result = repo.run({
      pull_request: {
        base: { sha: repo.base },
        head: { ref: 'bl/website-locale-updates', repo: { full_name } }
      }
    })
    expect(result.status).toBe(0)
    expect(result.args).toBe(expected)
  })
})
