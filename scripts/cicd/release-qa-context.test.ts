import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it, onTestFinished } from 'vitest'

import {
  qaOrigin,
  releasePrNumbers,
  releaseVersion,
  validateDraft,
  validateReleaseRef
} from './release-qa-context'

const base = 'a'.repeat(40)
const target = 'b'.repeat(40)
const draft = `## Release context\n${base} -> ${target}\n## Feature flags\nNo flags apply.\n## Test cases\n${'- [ ] Log in, reload, and verify identity and assets.\n'.repeat(10)}## Review before QA\n- [ ] Confirm scope and deployment.`

describe('release QA inputs', () => {
  it('collects unique PR references without interpreting commit text as code', () => {
    expect(
      releasePrNumbers('a fix (#42)\nb backport (#91) (#42)\nc $(command)')
    ).toEqual([42, 91])
  })
  it.for(['cloud/1.55', 'core/1.54', 'v1.54.2', '1.54.2', target])(
    'accepts a release ref %s',
    (ref) => {
      expect(validateReleaseRef(ref)).toBe(ref)
    }
  )
  it.for(['', 'main', '--help', 'cloud/1.55\nINJECT=x', 'a'.repeat(41)])(
    'rejects non-release refs %s',
    (ref) => {
      expect(() => validateReleaseRef(ref)).toThrow()
    }
  )
  it.for(['testcloud', 'stagingcloud'])(
    'selects the sandbox %s',
    (environment) => {
      expect(qaOrigin(environment)).toBe(`https://${environment}.comfy.org`)
    }
  )
  it('rejects production as the QA target', () => {
    expect(() => qaOrigin('cloud')).toThrow()
  })
  it('uses the candidate version', () => {
    expect(releaseVersion('{"version":"1.55.2"}')).toBe('1.55.2')
    expect(() => releaseVersion('{"version":"1.55\\ninject"}')).toThrow()
  })
})

describe('draft readiness', () => {
  it('accepts a reviewable draft tied to both SHAs', () => {
    expect(() => validateDraft(draft, base, target)).not.toThrow()
  })
  it.for([base, target, '## Feature flags', '## Review before QA'])(
    'rejects a draft missing %s',
    (required) => {
      expect(() =>
        validateDraft(draft.replace(required, ''), base, target)
      ).toThrow()
    }
  )
  it('rejects empty output', () => {
    expect(() => validateDraft('', base, target)).toThrow()
  })
})

it('resolves a snapshot and writes a delta without requiring a deployment', () => {
  const directory = mkdtempSync(join(tmpdir(), 'release-qa-context-'))
  onTestFinished(() => rmSync(directory, { recursive: true, force: true }))
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd: directory, encoding: 'utf8' }).trim()
  git('init', '--quiet')
  git('config', 'user.name', 'Test')
  git('config', 'user.email', 'test@example.invalid')
  const source = resolve('scripts/cicd/release-qa-context.ts')
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8'
  }).trim()
  git('fetch', '--quiet', '--depth=1', process.cwd(), sha)
  git('checkout', '--quiet', 'FETCH_HEAD', '--', 'package.json')
  git('commit', '--quiet', '-m', 'Baseline')
  const first = git('rev-parse', 'HEAD')
  git('commit', '--quiet', '--allow-empty', '-m', 'fix: candidate')
  const second = git('rev-parse', 'HEAD')
  execFileSync(process.execPath, [source], {
    cwd: directory,
    env: {
      ...process.env,
      TARGET_REF: second,
      BASE_REF: first,
      QA_ENVIRONMENT: 'testcloud',
      GITHUB_OUTPUT: join(directory, 'outputs'),
      GITHUB_ENV: ''
    }
  })
  expect(
    JSON.parse(
      readFileSync(join(directory, 'temp/plans/release-context.json'), 'utf8')
    )
  ).toMatchObject({
    base: first,
    target: second,
    environment: 'https://testcloud.comfy.org',
    deploymentVerified: false
  })
  expect(
    readFileSync(join(directory, 'temp/plans/release-commits.txt'), 'utf8')
  ).toContain('fix: candidate')
  expect(
    readFileSync(join(directory, 'temp/plans/release-prs.json'), 'utf8')
  ).toBe('{}')
})
