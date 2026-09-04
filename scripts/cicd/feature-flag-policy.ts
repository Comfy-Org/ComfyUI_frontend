#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { matchesGlob } from 'node:path'
import { pathToFileURL } from 'node:url'

export type RiskTier = 'low' | 'medium' | 'high' | 'xhigh'

interface RiskMap {
  path_rules: Array<{ class: string; paths: string[] }>
}

interface PullFile {
  filename: string
  previous_filename?: string
  patch?: string
}

interface PolicyFields {
  cloudRuntimeChange: string
  flag: string
  flagSource: string
  defaultOffEvidence: string
  productionOffEvidence: string
  offBehavior: string
  offTest: string
  exception: string
  exceptionEvidence: string
}

export interface PolicyInput {
  body: string
  labels: string[]
  risk: RiskTier | null
  runtimePaths: string[]
  registrySource?: string
  evidenceSource?: string
  testPathExists?: boolean
}

export interface PolicyResult {
  verdict: 'pass' | 'fail' | 'inconclusive'
  requiresAi: boolean
  reasons: string[]
}

const FIELD_NAMES = [
  'Cloud runtime change',
  'Flag',
  'Flag source',
  'Default-OFF code evidence',
  'Production-OFF evidence',
  'Flag-OFF behavior',
  'Flag-OFF test',
  'Exception',
  'Exception evidence'
] as const
const EXEMPT_CLASSES = new Set([
  'risk-map',
  'codeowners',
  'ci',
  'deps',
  'build-config',
  'website',
  'docs',
  'i18n-copy',
  'storybook',
  'tests'
])
const EXCEPTION_REASONS = new Set([
  'ci',
  'codeowners',
  'dependency',
  'release',
  'backport',
  'revert',
  'risk-map',
  'flag-rollout',
  'test-only',
  'non-cloud',
  'contract'
])
const PLACEHOLDERS = new Set([
  'key',
  'n/a',
  'na',
  'none',
  'not applicable',
  'tbd',
  'todo',
  'url',
  'path:line',
  'path:test',
  'description',
  'validation and rollback plan'
])

function clean(value: string): string {
  return value.trim().replace(/^`|`$/g, '').trim()
}

function isFilled(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return (
    normalized.length > 0 &&
    !normalized.includes(' | ') &&
    !PLACEHOLDERS.has(normalized)
  )
}

export function parsePolicyFields(body: string): {
  fields: PolicyFields | null
  errors: string[]
} {
  const heading = /^## Feature flag\s*$/im.exec(body)
  if (!heading)
    return { fields: null, errors: ['Missing `## Feature flag` section.'] }

  const rest = body.slice(heading.index + heading[0].length)
  const section = rest.slice(0, /^## /m.exec(rest)?.index)
  const entries = [...section.matchAll(/^- \*\*([^*]+)\*\*:\s*(.+?)\s*$/gm)]
    .filter((match) =>
      FIELD_NAMES.includes(match[1] as (typeof FIELD_NAMES)[number])
    )
    .map((match) => [match[1], clean(match[2])])
  const values = new Map(entries)
  const errors = FIELD_NAMES.filter((name) => !values.has(name)).map(
    (name) => `Missing field: ${name}.`
  )
  if (values.size !== entries.length)
    errors.push('Policy fields must be unique.')
  if (errors.length > 0) return { fields: null, errors }

  return {
    fields: {
      cloudRuntimeChange: values.get('Cloud runtime change')!,
      flag: values.get('Flag')!,
      flagSource: values.get('Flag source')!,
      defaultOffEvidence: values.get('Default-OFF code evidence')!,
      productionOffEvidence: values.get('Production-OFF evidence')!,
      offBehavior: values.get('Flag-OFF behavior')!,
      offTest: values.get('Flag-OFF test')!,
      exception: values.get('Exception')!,
      exceptionEvidence: values.get('Exception evidence')!
    },
    errors: []
  }
}

export function runtimePathsFor(
  files: Array<Pick<PullFile, 'filename' | 'previous_filename'>>,
  riskMap: RiskMap
): string[] {
  const paths = new Set(
    files.flatMap(({ filename, previous_filename }) =>
      previous_filename ? [filename, previous_filename] : [filename]
    )
  )

  return [...paths].filter((filePath) => {
    const classes = riskMap.path_rules
      .filter((rule) => rule.paths.some((glob) => matchesGlob(filePath, glob)))
      .map((rule) => rule.class)
    return !classes.some((riskClass) => EXEMPT_CLASSES.has(riskClass))
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function hasFailClosedDefault(
  flag: string,
  registrySource: string,
  evidenceSource: string
): boolean {
  const member = new RegExp(
    `([A-Z][A-Z0-9_]*)\\s*=\\s*['"]${escapeRegExp(flag)}['"]`
  ).exec(registrySource)?.[1]
  if (!member) return false

  const source = `${registrySource}\n${evidenceSource}`.replace(/\s+/g, ' ')
  const key = `ServerFeatureFlag\\.${member}`
  const off = `(?:false|'off'|"off"|''|"")`
  return [
    `resolveFlag\\(\\s*${key}\\s*,[^)]{0,400},\\s*${off}\\s*\\)`,
    `api\\.getServerFeature\\(\\s*${key}\\s*,\\s*${off}\\s*\\)`,
    `resolveAuthGatedFlag\\(\\s*${key}\\s*,`,
    `resolveFailClosedBooleanFlag\\(\\s*${key}\\s*\\)`
  ].some((pattern) => new RegExp(pattern).test(source))
}

export function evaluatePolicy(input: PolicyInput): PolicyResult {
  if (!input.risk)
    return {
      verdict: 'inconclusive',
      requiresAi: false,
      reasons: ['No current-head risk grade; a maintainer must re-run grading.']
    }
  if (input.risk === 'low' || input.risk === 'medium')
    return {
      verdict: 'pass',
      requiresAi: false,
      reasons: [`Risk is ${input.risk}; the policy does not apply.`]
    }
  if (input.runtimePaths.length === 0)
    return {
      verdict: 'pass',
      requiresAi: false,
      reasons: ['All changed paths are mechanically outside runtime scope.']
    }

  const parsed = parsePolicyFields(input.body)
  if (!parsed.fields)
    return { verdict: 'fail', requiresAi: false, reasons: parsed.errors }
  const fields = parsed.fields

  if (input.labels.includes('flag-exempt')) {
    const errors: string[] = []
    if (!EXCEPTION_REASONS.has(fields.exception))
      errors.push('`Exception` must name an allowed reason.')
    if (!isFilled(fields.exceptionEvidence))
      errors.push('`Exception evidence` must include validation and rollback.')
    return {
      verdict: errors.length ? 'fail' : 'pass',
      requiresAi: false,
      reasons: errors.length
        ? errors
        : [`Approved flag exception: ${fields.exception}.`]
    }
  }

  const errors: string[] = []
  if (fields.exception !== 'none')
    errors.push('An exception requires the `flag-exempt` label.')
  if (fields.cloudRuntimeChange !== 'yes')
    errors.push('In-scope paths require `Cloud runtime change: yes`.')
  if (!isFilled(fields.flag)) errors.push('`Flag` must name the rollout key.')
  if (!['new', 'existing'].includes(fields.flagSource))
    errors.push('`Flag source` must be `new` or `existing`.')
  if (!isFilled(fields.defaultOffEvidence))
    errors.push('`Default-OFF code evidence` is required.')
  if (!fields.productionOffEvidence.startsWith('https://'))
    errors.push('`Production-OFF evidence` must be an HTTPS URL.')
  if (!isFilled(fields.offBehavior))
    errors.push('`Flag-OFF behavior` must describe the unchanged path.')
  if (!isFilled(fields.offTest))
    errors.push('`Flag-OFF test` must identify an automated test.')
  else if (!isTestPath(fields.offTest))
    errors.push('`Flag-OFF test` must reference a test file.')
  if (
    isFilled(fields.flag) &&
    (!input.registrySource ||
      !input.evidenceSource ||
      !hasFailClosedDefault(
        fields.flag,
        input.registrySource,
        input.evidenceSource
      ))
  )
    errors.push('The named flag is not registered with a fail-closed default.')
  if (input.testPathExists === false)
    errors.push('The referenced OFF-path test does not exist.')

  return {
    verdict: errors.length ? 'fail' : 'pass',
    requiresAi: errors.length === 0,
    reasons: errors.length
      ? errors
      : ['Deterministic flag and evidence checks passed.']
  }
}

function evidencePath(value: string): string | null {
  const filePath = /^([^#]+?\.(?:ts|tsx|vue))(?::|#|$)/.exec(value)?.[1]
  return filePath && !filePath.startsWith('/') && !filePath.includes('..')
    ? filePath
    : null
}

function isTestPath(value: string): boolean {
  const filePath = evidencePath(value)
  return Boolean(
    filePath &&
    (/\.(?:test|spec)\.tsx?$/.test(filePath) ||
      filePath.startsWith('browser_tests/'))
  )
}

function gh(args: string[], input?: string): string {
  return execFileSync('gh', ['api', ...args], {
    encoding: 'utf8',
    env: { ...process.env, GH_TOKEN: process.env.GITHUB_TOKEN },
    input,
    maxBuffer: 50 * 1024 * 1024
  })
}

function repoFile(repo: string, ref: string, filePath: string): string {
  const encoded = filePath.split('/').map(encodeURIComponent).join('/')
  return gh([
    '-H',
    'Accept: application/vnd.github.raw+json',
    `repos/${repo}/contents/${encoded}?ref=${encodeURIComponent(ref)}`
  ])
}

function maybeRepoFile(repo: string, ref: string, value: string) {
  const filePath = evidencePath(value)
  if (!filePath) return undefined
  try {
    return repoFile(repo, ref, filePath)
  } catch {
    return undefined
  }
}

export function riskFromLabels(labels: string[]): RiskTier | null | 'conflict' {
  const disputes = labels
    .map((label) => /^risk-dispute:(low|medium|high|xhigh)$/.exec(label)?.[1])
    .filter((tier): tier is RiskTier => tier !== undefined)
  return disputes.length > 1 ? 'conflict' : (disputes[0] ?? null)
}

function currentRisk(repo: string, sha: string, waitSeconds: number) {
  for (let waited = 0; waited <= waitSeconds; waited += 15) {
    const checks = JSON.parse(
      gh([
        `repos/${repo}/commits/${sha}/check-runs?check_name=${encodeURIComponent('PR risk (advisory)')}&filter=latest&per_page=10`
      ])
    ) as {
      check_runs: Array<{ status: string; output?: { title?: string } }>
    }
    const title = checks.check_runs.find(({ status }) => status === 'completed')
      ?.output?.title
    const tier = /^Risk: R([0-3])$/.exec(title ?? '')?.[1]
    if (tier)
      return ['low', 'medium', 'high', 'xhigh'][Number(tier)] as RiskTier
    if (waited < waitSeconds)
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15_000)
  }
  return null
}

function publishCheck(
  repo: string,
  sha: string,
  risk: RiskTier | null,
  result: PolicyResult
) {
  const label =
    result.verdict === 'pass'
      ? 'pass'
      : result.verdict === 'fail'
        ? 'would block'
        : 'inconclusive'
  const summary = [
    '**Shadow mode:** this check is not required by `ProtectMain`.',
    '',
    `**Risk:** ${risk ?? 'unknown'}`,
    '',
    ...result.reasons.map((reason) => `- ${reason}`)
  ].join('\n')
  gh(
    ['--method', 'POST', `repos/${repo}/check-runs`, '--input', '-'],
    JSON.stringify({
      name: 'feature-flag-policy',
      head_sha: sha,
      status: 'completed',
      conclusion: result.verdict === 'pass' ? 'success' : 'failure',
      details_url: `${process.env.GITHUB_SERVER_URL}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}`,
      output: { title: `Feature flag policy: ${label}`, summary }
    })
  )
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`)
  process.stdout.write(`feature-flag-policy: ${label}\n`)
}

function main() {
  const repo = process.env.GITHUB_REPOSITORY
  const pr = Number(process.env.PR_NUMBER)
  if (!process.env.GITHUB_TOKEN || !repo || !Number.isInteger(pr) || pr < 1)
    throw new Error(
      'GITHUB_TOKEN, GITHUB_REPOSITORY, and PR_NUMBER are required.'
    )

  const pull = JSON.parse(gh([`repos/${repo}/pulls/${pr}`])) as {
    body: string | null
    base: { sha: string }
    head: { sha: string; repo: { full_name: string } | null }
    labels: Array<{ name: string }>
  }
  const labels = pull.labels.map(({ name }) => name)
  const disputed = riskFromLabels(labels)
  const risk =
    disputed === 'conflict'
      ? null
      : (disputed ??
        currentRisk(
          repo,
          pull.head.sha,
          pull.head.repo?.full_name === repo ? 720 : 0
        ))
  const files = JSON.parse(
    gh([
      '--paginate',
      '--slurp',
      `repos/${repo}/pulls/${pr}/files?per_page=100`
    ])
  ).flat() as PullFile[]
  const riskMap = JSON.parse(
    repoFile(repo, pull.base.sha, '.github/risk.json')
  ) as RiskMap
  const runtimePaths = runtimePathsFor(files, riskMap)
  const fields = parsePolicyFields(pull.body ?? '').fields
  const needsEvidence =
    (risk === 'high' || risk === 'xhigh') &&
    runtimePaths.length > 0 &&
    !labels.includes('flag-exempt')
  const registrySource = needsEvidence
    ? repoFile(repo, pull.head.sha, 'src/composables/useFeatureFlags.ts')
    : undefined
  const evidenceSource =
    needsEvidence && fields
      ? maybeRepoFile(repo, pull.head.sha, fields.defaultOffEvidence)
      : undefined
  const testSource =
    needsEvidence && fields
      ? maybeRepoFile(repo, pull.head.sha, fields.offTest)
      : undefined
  const result = evaluatePolicy({
    body: pull.body ?? '',
    labels,
    risk,
    runtimePaths,
    registrySource,
    evidenceSource,
    testPathExists: fields ? testSource !== undefined : false
  })
  if (disputed === 'conflict') {
    result.verdict = 'inconclusive'
    result.reasons = ['Multiple `risk-dispute:*` labels conflict.']
  }
  publishCheck(repo, pull.head.sha, risk, result)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main()
