#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { matchesGlob } from 'node:path'
import { pathToFileURL } from 'node:url'

interface PullFile {
  filename: string
  previous_filename?: string
}

interface RiskMap {
  path_rules: Array<{ class: string; tier: string; paths: string[] }>
}

export interface PolicyResult {
  verdict: 'not-applicable' | 'needs-flag' | 'review-required'
  reasons: string[]
  paths: string[]
}

const NON_RUNTIME_CLASSES = new Set([
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
const TOOLING_PATHS = [
  '.agents/**',
  '.claude/**',
  '.husky/**',
  '.oxlintrc.json',
  '.oxfmtrc.json',
  'eslint.config.*',
  'lint-staged.config.*',
  'stylelint.config.*',
  'playwright*.config.*',
  'vitest*.config.*',
  'vitest.setup.*',
  'tools/**'
]

export function evaluatePolicy(
  files: PullFile[],
  riskMap: RiskMap,
  body: string
): PolicyResult {
  const paths = [
    ...new Set(
      files.flatMap((file) =>
        file.previous_filename
          ? [file.filename, file.previous_filename]
          : [file.filename]
      )
    )
  ]
  const candidates = paths.flatMap((path) => {
    if (TOOLING_PATHS.some((pattern) => matchesGlob(path, pattern))) return []
    const rules = riskMap.path_rules.filter((rule) =>
      rule.paths.some((pattern) => matchesGlob(path, pattern))
    )
    if (rules.some((rule) => NON_RUNTIME_CLASSES.has(rule.class))) return []
    return [{ path, rules }]
  })
  if (candidates.length === 0) {
    return {
      verdict: 'not-applicable',
      reasons: [
        'No runtime paths require rollout review. Test, tooling, documentation, and delivery changes keep their normal CI and review requirements.'
      ],
      paths: []
    }
  }

  const highRisk = candidates.filter(({ rules }) =>
    rules.some((rule) => rule.tier === 'R2' || rule.tier === 'R3')
  )
  const unknown = candidates.filter(({ rules }) => rules.length === 0)
  const reasons = highRisk.map(
    ({ path, rules }) =>
      `${path}: ${rules
        .filter((rule) => rule.tier === 'R2' || rule.tier === 'R3')
        .map((rule) => `${rule.class} (${rule.tier})`)
        .join(', ')}`
  )
  if (unknown.length > 0) {
    reasons.push(
      'Unclassified paths need a reviewer to determine Cloud runtime impact; they are not automatically exempt or required to add a flag.'
    )
  }
  const heading = /^## Feature flag\s*$/im.exec(body)
  const rest = heading ? body.slice(heading.index + heading[0].length) : ''
  const section = rest.slice(0, /^## /m.exec(rest)?.index)
  const flags = [
    ...section.matchAll(/^- \*\*Flag\*\*:[ \t]*(.*?)[ \t]*$/gm)
  ].map((match) => match[1].trim().replace(/^`|`$/g, '').trim())
  const declared =
    flags.length === 1 &&
    /^[a-zA-Z0-9_.-]+$/.test(flags[0]) &&
    !/^(none|na|n\/a|auto|key|tbd|todo)$/i.test(flags[0])

  if (highRisk.length > 0 && !declared) {
    reasons.push(
      'For Cloud runtime behavior, declare one rollout flag under `## Feature flag`, or document why a flag is unsuitable with validation and rollback evidence for reviewer approval.'
    )
  } else {
    reasons.push(
      'Review Cloud applicability, rollout containment, production-OFF state, OFF-path coverage, and rollback. A declaration is not verification.'
    )
  }
  return {
    verdict:
      highRisk.length > 0 && !declared ? 'needs-flag' : 'review-required',
    reasons,
    paths: candidates.map(({ path }) => path)
  }
}

export function checkOutput(result: PolicyResult, sha: string) {
  return {
    name: 'feature-flag-policy',
    head_sha: sha,
    status: 'completed',
    conclusion: 'neutral',
    output: {
      title: `Feature flag advice: ${result.verdict}`,
      summary: [
        '**Advisory only.** This is not a test result or a merge gate.',
        '',
        `Head: \`${sha}\``,
        'Scope comes from trusted path rules. Risk labels, risk check output, and CI rollups are not inputs.',
        '',
        ...result.reasons.map((reason) => `- ${reason}`),
        '',
        'Runtime or unclassified paths:',
        ...result.paths.map((path) => `- \`${path}\``)
      ]
        .join('\n')
        .slice(0, 60_000)
    }
  }
}

function gh(args: string[], input?: string): string {
  return execFileSync('gh', ['api', ...args], {
    encoding: 'utf8',
    input,
    maxBuffer: 50 * 1024 * 1024
  })
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isRiskMap(value: unknown): value is RiskMap {
  return (
    object(value) &&
    Array.isArray(value.path_rules) &&
    value.path_rules.every(
      (rule: unknown) =>
        object(rule) &&
        typeof rule.class === 'string' &&
        typeof rule.tier === 'string' &&
        ['R0', 'R1', 'R2', 'R3'].includes(rule.tier) &&
        stringArray(rule.paths)
    )
  )
}

function isPullFile(value: unknown): value is PullFile {
  return (
    object(value) &&
    typeof value.filename === 'string' &&
    (value.previous_filename === undefined ||
      typeof value.previous_filename === 'string')
  )
}

function readPull(repo: string, pr: number) {
  const value: unknown = JSON.parse(gh([`repos/${repo}/pulls/${pr}`]))
  if (
    !object(value) ||
    !object(value.head) ||
    typeof value.head.sha !== 'string' ||
    typeof value.changed_files !== 'number' ||
    (value.body !== null && typeof value.body !== 'string')
  ) {
    throw new Error('Invalid pull request metadata.')
  }
  return {
    sha: value.head.sha,
    body: value.body ?? '',
    changedFiles: value.changed_files
  }
}

export function main() {
  const repo = process.env.GITHUB_REPOSITORY
  const pr = Number(process.env.PR_NUMBER)
  if (!repo || !Number.isInteger(pr) || pr < 1) {
    throw new Error('GITHUB_REPOSITORY and PR_NUMBER are required.')
  }
  const pull = readPull(repo, pr)
  const pages: unknown = JSON.parse(
    gh([
      '--paginate',
      '--slurp',
      `repos/${repo}/pulls/${pr}/files?per_page=100`
    ])
  )
  if (!Array.isArray(pages) || !pages.every(Array.isArray)) {
    throw new Error('Invalid changed-file response.')
  }
  const files: unknown[] = pages.flat()
  if (!files.every(isPullFile) || files.length !== pull.changedFiles) {
    throw new Error(
      'Incomplete or invalid changed-file list; no policy advice published.'
    )
  }
  const riskMap: unknown = JSON.parse(readFileSync('.github/risk.json', 'utf8'))
  if (!isRiskMap(riskMap)) throw new Error('Invalid trusted risk map.')
  const result = evaluatePolicy(files, riskMap, pull.body)
  const current = readPull(repo, pr)
  if (
    current.sha !== pull.sha ||
    current.body !== pull.body ||
    current.changedFiles !== pull.changedFiles
  ) {
    throw new Error(
      'Pull request changed during evaluation; rerun policy advice.'
    )
  }
  const check = checkOutput(result, pull.sha)
  if (process.argv.includes('--dry-run')) {
    process.stdout.write(`${JSON.stringify(check, null, 2)}\n`)
    return
  }
  gh(
    ['--method', 'POST', `repos/${repo}/check-runs`, '--input', '-'],
    JSON.stringify(check)
  )
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${check.output.summary}\n`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main()
