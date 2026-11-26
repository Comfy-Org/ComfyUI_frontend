import AxeBuilder from '@axe-core/playwright'
import type { Page, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'

import { compareViolationCounts } from '@e2e/fixtures/utils/accessibilityViolationCounts'
import { finishFiniteAnimations } from '@e2e/fixtures/utils/finiteAnimations'

type AxeViolation = Awaited<
  ReturnType<AxeBuilder['analyze']>
>['violations'][number]

type KnownElementCounts = Readonly<Record<string, number>>

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

  /** Fails unless each rule fails on exactly the element count in `knownViolations`; an unlisted rule allows none. */
  async expectOnlyKnownViolations(
    knownViolations: KnownElementCounts,
    axeBuilder: AxeBuilder = this.makeAxeBuilder()
  ): Promise<void> {
    const documentHandle = await this.page.evaluateHandle(() => document)
    await documentHandle.evaluate(finishFiniteAnimations)
    const results = await axeBuilder.analyze()
    await this.testInfo.attach('axe-violations', {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json'
    })

    const { exceeded, reduced } = compareViolationCounts(
      knownViolations,
      Object.fromEntries(
        results.violations.map(({ id, nodes }) => [id, nodes.length])
      )
    )
    const knownElementsByExceededRule = new Map(
      exceeded.map(({ rule, knownElements }) => [rule, knownElements])
    )
    const newViolations = results.violations.flatMap((violation) => {
      const knownElements = knownElementsByExceededRule.get(violation.id)
      return knownElements === undefined
        ? []
        : [{ ...describeViolation(violation), knownElements }]
    })
    expect
      .soft(
        newViolations,
        'Accessibility violations on more elements than this scan knows. Fix the new elements; the axe-violations attachment has the details.'
      )
      .toEqual([])

    expect(
      reduced,
      'Known accessibility violations that now fail on fewer elements. Lower their counts in this scan to the found counts, and remove a rule at zero.'
    ).toEqual([])
  }
}
