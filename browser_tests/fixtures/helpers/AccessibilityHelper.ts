import AxeBuilder from '@axe-core/playwright'
import type { Page, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'
import { difference } from 'es-toolkit'

type AxeViolation = Awaited<
  ReturnType<AxeBuilder['analyze']>
>['violations'][number]

const RULE_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice'
]

function describeViolation({ id, impact, help, helpUrl, nodes }: AxeViolation) {
  return {
    rule: id,
    impact,
    help,
    helpUrl,
    elements: nodes.map(({ target, failureSummary }) => ({
      target,
      failureSummary
    }))
  }
}

export class AccessibilityHelper {
  constructor(
    private readonly page: Page,
    private readonly testInfo: TestInfo
  ) {}

  /** An axe scan of the whole page for WCAG A/AA and best-practice rules. */
  makeAxeBuilder(): AxeBuilder {
    return new AxeBuilder({ page: this.page }).withTags(RULE_TAGS)
  }

  /** Fails on a violated rule outside `knownRules` and on a known rule that no longer fires. */
  async expectOnlyKnownViolations(
    knownRules: readonly string[],
    axeBuilder: AxeBuilder = this.makeAxeBuilder()
  ): Promise<void> {
    const results = await axeBuilder.analyze()
    await this.testInfo.attach('axe-violations', {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json'
    })

    const newViolations = results.violations.filter(
      ({ id }) => !knownRules.includes(id)
    )
    expect
      .soft(
        newViolations.map(describeViolation),
        'New accessibility violations. Fix them; the axe-violations attachment has the details.'
      )
      .toEqual([])

    const violatedRules = results.violations.map(({ id }) => id)
    expect(
      difference(knownRules, violatedRules),
      'Known accessibility violations that no longer occur. Remove them from this scan.'
    ).toEqual([])
  }
}
