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

export interface PolicyInput {
  body: string
  labels: string[]
  risk: RiskTier | null
  runtimePaths: string[]
  registrySource?: string
  baseRegistrySource?: string
}

export interface PolicyResult {
  verdict: 'pass' | 'fail' | 'inconclusive'
  requiresAi: boolean
  reasons: string[]
  flag?: string
  flagOrigin?: 'new' | 'existing'
}

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
const PLACEHOLDERS = new Set([
  'key',
  'auto',
  'n/a',
  'na',
  'none',
  'not applicable',
  'tbd',
  'todo'
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

export function parseDeclaredFlag(body: string): {
  flag: string | null
  errors: string[]
} {
  const heading = /^## Feature flag\s*$/im.exec(body)
  if (!heading) return { flag: null, errors: [] }

  const rest = body.slice(heading.index + heading[0].length)
  const section = rest.slice(0, /^## /m.exec(rest)?.index)
  const values = [
    ...section.matchAll(/^- \*\*Flag\*\*:[ \t]*(.*?)[ \t]*$/gm)
  ].map((match) => clean(match[1]))
  if (values.length > 1)
    return { flag: null, errors: ['The `Flag` field must be unique.'] }

  const value = values[0] ?? ''
  return { flag: isFilled(value) ? value : null, errors: [] }
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
  registrySource: string
): boolean {
  const member = new RegExp(
    `([A-Z][A-Z0-9_]*)\\s*=\\s*['"]${escapeRegExp(flag)}['"]`
  ).exec(registrySource)?.[1]
  if (!member) return false

  const source = registrySource.replace(/\s+/g, ' ')
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

  if (input.labels.includes('flag-exempt'))
    return {
      verdict: 'pass',
      requiresAi: false,
      reasons: [
        '`flag-exempt` is present; validation and rollback remain reviewer-owned.'
      ]
    }

  const declared = parseDeclaredFlag(input.body)
  if (declared.errors.length)
    return { verdict: 'fail', requiresAi: false, reasons: declared.errors }

  const flag = declared.flag
  if (!flag)
    return {
      verdict: 'fail',
      requiresAi: false,
      reasons: ['The author must provide the `Flag` field.']
    }

  if (
    !input.registrySource ||
    !hasFailClosedDefault(flag, input.registrySource)
  )
    return {
      verdict: 'fail',
      requiresAi: false,
      reasons: [
        `Flag \`${flag}\` is not registered with a fail-closed default.`
      ],
      flag
    }

  const flagOrigin =
    input.baseRegistrySource &&
    new RegExp(`=\\s*['"]${escapeRegExp(flag)}['"]`).test(
      input.baseRegistrySource
    )
      ? 'existing'
      : 'new'
  return {
    verdict: 'pass',
    requiresAi: true,
    reasons: [`Flag \`${flag}\` is ${flagOrigin} and defaults OFF in code.`],
    flag,
    flagOrigin
  }
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
  const needsReview =
    (risk === 'high' || risk === 'xhigh') &&
    runtimePaths.length > 0 &&
    !labels.includes('flag-exempt')
  const registrySource = needsReview
    ? repoFile(repo, pull.head.sha, 'src/composables/useFeatureFlags.ts')
    : undefined
  const baseRegistrySource = needsReview
    ? repoFile(repo, pull.base.sha, 'src/composables/useFeatureFlags.ts')
    : undefined
  const result = evaluatePolicy({
    body: pull.body ?? '',
    labels,
    risk,
    runtimePaths,
    registrySource,
    baseRegistrySource
  })
  if (disputed === 'conflict') {
    result.verdict = 'inconclusive'
    result.reasons = ['Multiple `risk-dispute:*` labels conflict.']
  }
  publishCheck(repo, pull.head.sha, risk, result)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main()
