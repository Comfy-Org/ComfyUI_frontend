import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { checkOutput, evaluatePolicy } from './feature-flag-policy'

const flag = '## Feature flag\n- **Flag**: safe_feature'
const rationale =
  '## Feature flag\n- **Rationale**: Removes obsolete code; covered by regression tests and revertible.'

describe('label-driven feature flag policy', () => {
  it.for([
    { name: 'low risk', labels: ['risk:low'], body: '', verdict: 'pass' },
    { name: 'medium risk', labels: ['risk:medium'], body: '', verdict: 'pass' },
    {
      name: 'high risk with flag',
      labels: ['risk:high'],
      body: flag,
      verdict: 'pass'
    },
    {
      name: 'xhigh risk with flag',
      labels: ['risk:xhigh'],
      body: flag,
      verdict: 'pass'
    },
    {
      name: 'downgraded risk',
      labels: ['risk:xhigh', 'risk-dispute:medium'],
      body: rationale,
      verdict: 'pass'
    },
    {
      name: 'flag exception',
      labels: ['risk:high', 'flag-dispute'],
      body: rationale,
      verdict: 'pass'
    },
    {
      name: 'no flag or rationale',
      labels: ['risk:high'],
      body: '',
      verdict: 'fail'
    },
    {
      name: 'rationale without exception label',
      labels: ['risk:xhigh'],
      body: rationale,
      verdict: 'fail'
    },
    {
      name: 'exception label without rationale',
      labels: ['risk:high', 'flag-dispute'],
      body: '',
      verdict: 'fail'
    },
    {
      name: 'untyped risk dispute',
      labels: ['risk:high', 'risk-dispute'],
      body: rationale,
      verdict: 'fail'
    },
    {
      name: 'unrecognized exemption label',
      labels: ['risk:high', 'flag-exempt'],
      body: rationale,
      verdict: 'fail'
    },
    {
      name: 'missing classification',
      labels: [],
      body: flag,
      verdict: 'ungraded'
    },
    {
      name: 'unknown classification',
      labels: ['risk:unknown'],
      body: flag,
      verdict: 'ungraded'
    }
  ])('$name', ({ labels, body, verdict }) => {
    expect(evaluatePolicy(labels, body).verdict).toBe(verdict)
  })

  it.for([
    {
      labels: ['risk:high', 'risk-dispute:low'],
      risk: 'risk:low (overridden by risk-dispute:low)',
      verdict: 'pass'
    },
    {
      labels: ['risk:low', 'risk-dispute:high'],
      risk: 'risk:high (overridden by risk-dispute:high)',
      verdict: 'fail'
    },
    {
      labels: ['risk:low', 'risk-dispute:low', 'risk-dispute:xhigh'],
      risk: 'risk:xhigh (overridden by risk-dispute:xhigh)',
      verdict: 'fail'
    },
    {
      labels: ['risk:xhigh', 'risk-dispute:low', 'risk-dispute:medium'],
      risk: 'risk:medium (overridden by risk-dispute:medium)',
      verdict: 'pass'
    },
    {
      labels: ['RISK:HIGH', 'RISK-DISPUTE:LOW'],
      risk: 'risk:low (overridden by risk-dispute:low)',
      verdict: 'pass'
    },
    { labels: ['risk:low', 'risk:xhigh'], risk: 'risk:xhigh', verdict: 'fail' },
    {
      labels: ['risk:low', 'risk:unknown'],
      risk: 'ungraded',
      verdict: 'ungraded'
    }
  ])(
    'matches risk-grader dispute precedence: $labels',
    ({ labels, risk, verdict }) => {
      expect(evaluatePolicy(labels, '')).toMatchObject({ risk, verdict })
    }
  )

  it('removes the exception when its label is removed', () => {
    expect(
      evaluatePolicy(['risk:high', 'flag-dispute'], rationale).verdict
    ).toBe('pass')
    expect(evaluatePolicy(['risk:high'], rationale).verdict).toBe('fail')
    expect(evaluatePolicy(['risk:high', 'risk-dispute:low'], '').verdict).toBe(
      'pass'
    )
    expect(evaluatePolicy(['risk:high'], '').verdict).toBe('fail')
  })

  it('accepts a rationale written across multiple lines', () => {
    expect(
      evaluatePolicy(
        ['risk:high', 'flag-dispute'],
        [
          '## Feature flag',
          '- **Rationale**:',
          '  This removes obsolete code.',
          '  Regression tests cover the remaining behavior.',
          '- **Validation**: Tests passed.'
        ].join('\n')
      ).verdict
    ).toBe('pass')
  })

  it.for(['```', '~~~'])(
    'accepts declarations after a closed %s fence',
    (fence) => {
      expect(
        evaluatePolicy(
          ['risk:high'],
          `${fence}\nexample\n${fence}${fence[0]}\n${flag}`
        ).verdict
      ).toBe('pass')
    }
  )

  it.for([flag, '## Feature flag\n- **Flag**: `safe_feature`'])(
    'passes declarations without claiming verification',
    (body) => {
      const result = evaluatePolicy(['risk:high'], body)
      expect(result.verdict).toBe('pass')
      expect(result.reason).toContain('A declaration is not verification.')
    }
  )

  it.for([
    '',
    '## Feature flag\n- **Flag**: none',
    '## Feature flag\n# Summary\n- **Flag**: safe_feature',
    '## Feature flag\n  ## Summary\n- **Flag**: safe_feature',
    '## Feature flag\n##\tSummary\n- **Flag**: safe_feature',
    '## Feature flag\n- **Flag**: `safe_feature',
    '## Feature flag\n- **Flag**: safe_feature`',
    '<!--\n## Feature flag\n- **Flag**: safe_feature\n-->',
    '## Feature flag\n<!--\n- **Flag**: safe_feature\n-->',
    '```markdown\n## Feature flag\n- **Flag**: safe_feature\n```',
    '## Feature flag\n~~~\n- **Flag**: safe_feature\n~~~',
    '## Feature flag\n```\n- **Flag**: safe_feature',
    '## Feature flag\n- **Flag**: -',
    '## Feature flag\n- **Flag**: .',
    '## Feature flag\n- **Flag**: ---',
    '## Feature flag\n- **Flag**: TODO',
    '## Feature flag\n- **Flag**: safe_feature\n- **Flag**: other',
    '## Summary\n- **Flag**: safe_feature',
    '## Feature flag\n\n## Summary\n- **Flag**: safe_feature'
  ])('rejects absent, hidden or ambiguous flag declarations: %s', (body) => {
    expect(evaluatePolicy(['risk:high'], body).verdict).toBe('fail')
  })

  it.for([
    '## Feature flag\n- **Rationale**:',
    '## Feature flag\n- **Rationale**: TODO',
    '## Feature flag\n- **Rationale**: `none`',
    '## Feature flag\n- **Rationale**:\n- **Validation**: Tests passed.',
    '## Feature flag\n- **Rationale**:\n### Validation\nTests passed.',
    '## Feature flag\n- **Rationale**: ---',
    '## Feature flag\n- **Rationale**: <!-- explanation -->',
    `<!-- ${rationale} -->`,
    `\`\`\`markdown\n${rationale}\n\`\`\``,
    '## Feature flag\n## Summary\n- **Rationale**: A repair.',
    `${rationale}\n- **Rationale**: Conflicting explanation.`
  ])('rejects missing or hidden exception rationale: %s', (body) => {
    expect(evaluatePolicy(['risk:high', 'flag-dispute'], body).verdict).toBe(
      'fail'
    )
  })

  it('uses the actual template for flags and exceptions', () => {
    const template = readFileSync('.github/pull_request_template.md', 'utf8')
    expect(evaluatePolicy(['risk:high'], template).verdict).toBe('fail')
    expect(
      evaluatePolicy(
        ['risk:high'],
        template.replace('**Flag**:', '**Flag**: safe_feature')
      ).verdict
    ).toBe('pass')
    expect(
      evaluatePolicy(
        ['risk:high', 'flag-dispute'],
        template.replace(
          '**Rationale**:',
          '**Rationale**: Repair covered by tests; revert restores behavior.'
        )
      ).verdict
    ).toBe('pass')
  })

  it.for([
    { labels: ['risk:low'], verdict: 'PASS' },
    { labels: ['risk:high'], verdict: 'FAIL' },
    { labels: [], verdict: 'UNGRADED' }
  ])(
    'keeps $verdict advisory without feeding a failure into CI-based risk',
    ({ labels, verdict }) => {
      expect(
        checkOutput(evaluatePolicy(labels, ''), 'a'.repeat(40))
      ).toMatchObject({
        conclusion: 'neutral',
        output: { title: `Feature flag policy: ${verdict} (advisory)` }
      })
    }
  )
})
