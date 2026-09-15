#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

interface PolicyIO {
  request: (args: string[], input?: string) => string
  readFile: (path: string) => string
  appendFile: (path: string, text: string) => void
}

export interface PolicyResult {
  verdict: 'pass' | 'fail' | 'ungraded'
  reason: string
  risk: string
}

function declarationText(body: string) {
  const lines = body.replace(/<!--[\s\S]*?(?:-->|$)/g, '').split('\n')
  let fence: string | undefined
  return lines
    .filter((line) => {
      const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
      if (!marker) return !fence
      if (!fence) {
        fence = marker[1]
      } else if (
        marker[1][0] === fence[0] &&
        marker[1].length >= fence.length &&
        marker[2].trim() === ''
      ) {
        fence = undefined
      }
      return false
    })
    .join('\n')
}

export function evaluatePolicy(labels: string[], body: string): PolicyResult {
  const names = labels.map((label) => label.toLowerCase())
  const tiers = ['xhigh', 'high', 'medium', 'low']
  const dispute = tiers.find((tier) => names.includes(`risk-dispute:${tier}`))
  const tier = dispute ?? tiers.find((value) => names.includes(`risk:${value}`))
  const risk = dispute
    ? `risk:${dispute} (overridden by risk-dispute:${dispute})`
    : tier
      ? `risk:${tier}`
      : 'ungraded'
  if (!tier || (!dispute && names.includes('risk:unknown'))) {
    return {
      verdict: 'ungraded',
      reason:
        'Risk labels are missing or unknown. A maintainer can assign a risk label or run manual grading. Fork and Dependabot PRs are not graded automatically; no merge action is required for this advisory check.',
      risk: 'ungraded'
    }
  }
  if (tier === 'low' || tier === 'medium') {
    return {
      verdict: 'pass',
      reason:
        'Effective risk is below high; no feature flag is required by this policy.',
      risk
    }
  }
  const text = declarationText(body)
  const heading = /^## Feature flag\s*$/im.exec(text)
  const rest = heading ? text.slice(heading.index + heading[0].length) : ''
  const section = rest.slice(0, /^ {0,3}#{1,2}(?:[ \t]+|$)/m.exec(rest)?.index)
  const flags = [
    ...section.matchAll(/^- \*\*Flag\*\*:[ \t]*(.*?)[ \t]*$/gm)
  ].map((match) =>
    match[1]
      .trim()
      .replace(/^`(.+)`$/, '$1')
      .trim()
  )
  const declared =
    flags.length === 1 &&
    /^[a-zA-Z0-9_.-]+$/.test(flags[0]) &&
    /[a-zA-Z0-9]/.test(flags[0]) &&
    !/^(none|na|n\/a|auto|key|tbd|todo)$/i.test(flags[0])

  if (declared) {
    return {
      verdict: 'pass',
      reason:
        'A rollout flag is declared. Reviewers still verify containment, production-OFF state, OFF-path tests and rollback. A declaration is not verification.',
      risk
    }
  }
  const rationales = section
    .split(/(?=^- \*\*[^*]+\*\*:|^#{1,6}(?:[ \t]+|$))/m)
    .filter((field) => field.startsWith('- **Rationale**:'))
    .map((field) => field.slice('- **Rationale**:'.length).trim())
  const rationale =
    rationales.length === 1
      ? rationales[0].replace(/^`(.+)`$/, '$1').trim()
      : ''
  if (
    names.includes('flag-dispute') &&
    /[\p{L}\p{N}]/u.test(rationale) &&
    !/^(none|na|n\/a|tbd|todo)$/i.test(rationale)
  ) {
    return {
      verdict: 'pass',
      reason:
        'Flag exception recorded with flag-dispute and a rationale. Reviewers assess the explanation, validation and rollback evidence.',
      risk
    }
  }
  return {
    verdict: 'fail',
    reason:
      'High-risk changes need a rollout flag, a risk-dispute downgrade below high, or flag-dispute with a Rationale under ## Feature flag. Rationale alone or a label alone does not pass.',
    risk
  }
}

export function checkOutput(result: PolicyResult, sha: string) {
  const summary = [
    '**Advisory only.** PASS/FAIL describes this policy, not test results. Neither outcome blocks merging.',
    '',
    `Head: \`${sha}\``,
    `Effective risk: ${result.risk}`,
    '',
    result.reason,
    '',
    'Risk labels and named risk-dispute overrides are the source of truth. Normal CI and review requirements still apply.'
  ].join('\n')
  return {
    name: 'feature-flag-policy',
    head_sha: sha,
    status: 'completed',
    conclusion: 'neutral',
    output: {
      title: `Feature flag policy: ${result.verdict.toUpperCase()} (advisory)`,
      summary
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

function integerAtLeast(value: unknown, minimum: number): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum
  )
}

function isSha(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value)
}

function parseLabels(value: unknown[]) {
  return [
    ...new Set(
      value.map((label: unknown) => {
        if (!object(label) || typeof label.name !== 'string') {
          throw new Error('Invalid pull request labels.')
        }
        return label.name.toLowerCase()
      })
    )
  ].sort()
}

function readPull(repo: string, pr: number, request: PolicyIO['request']) {
  const value: unknown = JSON.parse(request([`repos/${repo}/pulls/${pr}`]))
  if (
    !object(value) ||
    !object(value.head) ||
    !isSha(value.head.sha) ||
    value.state !== 'open' ||
    !Array.isArray(value.labels) ||
    (value.body !== null && typeof value.body !== 'string')
  ) {
    throw new Error('Invalid pull request metadata.')
  }
  return {
    sha: value.head.sha,
    body: value.body ?? '',
    labels: parseLabels(value.labels)
  }
}

function readRequests(readFile: PolicyIO['readFile']) {
  const requestPath = process.env.POLICY_REQUEST_PATH
  if (!requestPath) throw new Error('POLICY_REQUEST_PATH is required.')
  const requests: unknown = JSON.parse(readFile(requestPath))
  if (!Array.isArray(requests) || requests.length === 0) {
    throw new Error('Policy request must contain at least one target.')
  }
  if (
    process.env.TRUSTED_DEFAULT_BRANCH_DISPATCH !== 'true' &&
    requests.length !== 1
  ) {
    throw new Error(
      'A PR-event policy request must contain exactly one target.'
    )
  }
  return requests.map((request: unknown) => {
    if (
      !object(request) ||
      !integerAtLeast(request.pr_number, 1) ||
      !isSha(request.head_sha) ||
      (process.env.TRUSTED_DEFAULT_BRANCH_DISPATCH !== 'true' &&
        (request.pr_number !== Number(process.env.PR_NUMBER) ||
          request.head_sha !== process.env.EXPECTED_HEAD_SHA))
    ) {
      throw new Error(
        'Policy request does not match the current workflow target.'
      )
    }
    return { pr: request.pr_number, sha: request.head_sha }
  })
}

function evaluatePull(
  repo: string,
  { pr, sha }: ReturnType<typeof readRequests>[number],
  io: PolicyIO
) {
  const pull = readPull(repo, pr, io.request)
  if (pull.sha !== sha) {
    throw new Error('Policy request does not match the current PR head.')
  }
  const result = evaluatePolicy(pull.labels, pull.body)
  const current = readPull(repo, pr, io.request)
  if (
    current.sha !== pull.sha ||
    current.body !== pull.body ||
    JSON.stringify(current.labels) !== JSON.stringify(pull.labels)
  ) {
    throw new Error(
      'Pull request changed during evaluation; rerun policy advice.'
    )
  }
  return checkOutput(result, pull.sha)
}

export function main(
  io: PolicyIO = {
    request: gh,
    readFile: (path) => readFileSync(path, 'utf8'),
    appendFile: appendFileSync
  }
) {
  const repo = process.env.GITHUB_REPOSITORY
  if (!repo) {
    throw new Error('GITHUB_REPOSITORY is required.')
  }
  const errors: string[] = []
  for (const request of readRequests(io.readFile)) {
    try {
      const check = evaluatePull(repo, request, io)
      if (process.argv.includes('--dry-run')) {
        process.stdout.write(`${JSON.stringify(check)}\n`)
        continue
      }
      io.request(
        ['--method', 'POST', `repos/${repo}/check-runs`, '--input', '-'],
        JSON.stringify(check)
      )
      if (process.env.GITHUB_STEP_SUMMARY) {
        io.appendFile(
          process.env.GITHUB_STEP_SUMMARY,
          `${check.output.summary}\n`
        )
      }
    } catch (error) {
      errors.push(
        `PR #${request.pr}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
  if (errors.length > 0) throw new Error(errors.join('\n'))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main()
