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
