import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs'

const planDirectory = 'temp/plans'

export function validateReleaseRef(ref: string): string {
  if (
    !/^(?:[a-f0-9]{7,40}|(?:cloud|core)\/\d+\.\d+|v?\d+\.\d+\.\d+)$/.test(ref)
  )
    throw new Error(
      'Use a cloud/core release branch, version tag or commit SHA'
    )
  return ref
}

export function qaOrigin(environment: string): string {
  if (!['testcloud', 'stagingcloud'].includes(environment))
    throw new Error('QA environment must be testcloud or stagingcloud')
  return `https://${environment}.comfy.org`
}

export function releaseVersion(packageJson: string): string {
  const data: unknown = JSON.parse(packageJson)
  if (
    typeof data !== 'object' ||
    data === null ||
    !('version' in data) ||
    typeof data.version !== 'string' ||
    !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(data.version)
  )
    throw new Error('Candidate package.json has no valid release version')
  return data.version
}

export function releasePrNumbers(commits: string): number[] {
  return [
    ...new Set(
      [...commits.matchAll(/\(#(\d+)\)/g)].map((match) => Number(match[1]))
    )
  ]
}

export function validateDraft(
  draft: string,
  base: string,
  target: string
): void {
  if (draft.length < 500 || draft.length > 200_000)
    throw new Error('Draft is missing, too short or too large')
  for (const required of [
    base,
    target,
    '## Release context',
    '## Feature flags',
    '## Test cases',
    '## Review before QA',
    '- [ ]'
  ]) {
    if (!draft.includes(required))
      throw new Error(`Draft is missing ${required}`)
  }
}

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function resolveRef(ref: string): string {
  validateReleaseRef(ref)
  const revision = ref.includes('/') ? `refs/remotes/origin/${ref}` : ref
  const sha = git('rev-parse', '--verify', `${revision}^{commit}`)
  if (!/^[a-f0-9]{40}$/.test(sha))
    throw new Error('Ref did not resolve to a full SHA')
  return sha
}

async function main(): Promise<void> {
  if (process.argv[2] === 'validate') {
    const path = `${planDirectory}/release-qa.md`
    if (!lstatSync(path).isFile())
      throw new Error('Draft must be a regular file')
    const base = process.env.QA_BASE_SHA
    const target = process.env.QA_TARGET_SHA
    if (!base || !target) throw new Error('Resolved SHAs are required')
    validateDraft(readFileSync(path, 'utf8'), base, target)
    return
  }
  const target = resolveRef(process.env.TARGET_REF ?? '')
  let baseRef = process.env.BASE_REF
  if (!baseRef) {
    const response = await fetch('https://cloud.comfy.org/', {
      method: 'HEAD',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000)
    })
    if (!response.ok)
      throw new Error(
        `Production version lookup failed: HTTP ${response.status}`
      )
    baseRef = response.headers.get('x-frontend-version') ?? ''
    if (!/^[a-f0-9]{7,40}$/.test(baseRef))
      throw new Error(
        'Production did not return a valid frontend SHA; supply base explicitly'
      )
  }
  const base = resolveRef(baseRef)
  const environment = qaOrigin(process.env.QA_ENVIRONMENT ?? 'testcloud')
  const version = releaseVersion(git('show', `${target}:package.json`))
  mkdirSync(planDirectory, { recursive: true })
  writeFileSync(
    `${planDirectory}/release-context.json`,
    JSON.stringify(
      {
        base,
        target,
        version,
        environment,
        deploymentVerified: false
      },
      null,
      2
    ) + '\n'
  )
  const range = [
    'log',
    '--cherry-pick',
    '--right-only',
    '--no-merges',
    '--format=%H %s',
    `${base}...${target}`
  ]
  const commits = git(...range)
  writeFileSync(`${planDirectory}/release-commits.txt`, commits + '\n')
  writeFileSync(
    `${planDirectory}/release-changes.patch`,
    git(...range, '--patch', '--no-ext-diff') + '\n'
  )
  const numbers = releasePrNumbers(commits)
  const prs = numbers.length
    ? execFileSync('gh', ['api', 'graphql', '--input', '-'], {
        encoding: 'utf8',
        input: JSON.stringify({
          query: `{repository(owner:"Comfy-Org",name:"ComfyUI_frontend"){${numbers.map((number) => `pr${number}:pullRequest(number:${number}){number title body url labels(first:50){nodes{name}}}`).join('\n')}}}`
        })
      })
    : '{}'
  writeFileSync(`${planDirectory}/release-prs.json`, prs)
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `base=${base}\ntarget=${target}\nversion=${version}\nenvironment=${environment}\n`
    )
}

if (import.meta.main) await main()
