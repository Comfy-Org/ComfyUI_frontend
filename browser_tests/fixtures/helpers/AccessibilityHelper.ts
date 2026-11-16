import AxeBuilder from '@axe-core/playwright'
import type { Page, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'

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

async function finishFiniteAnimations(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter(
          ({ effect }) => effect?.getComputedTiming().endTime !== Infinity
        )
        .map(({ finished }) => finished)
    )
  )
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
    await finishFiniteAnimations(this.page)
    const results = await axeBuilder.analyze()
    await this.testInfo.attach('axe-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json'
    })

    const known = new Map(Object.entries(knownViolations))
    const newViolations = results.violations
      .map((violation) => ({
        ...describeViolation(violation),
        knownElements: known.get(violation.id) ?? 0
      }))
      .filter(({ elements, knownElements }) => elements.length > knownElements)
    expect
      .soft(
        newViolations,
        'Accessibility violations on more elements than this scan knows. Fix the new elements; the axe-results attachment has the full scan.'
      )
      .toEqual([])

    const found = new Map(
      results.violations.map(({ id, nodes }) => [id, nodes.length])
    )
    const fixedViolations = [...known]
      .map(([rule, knownElements]) => ({
        rule,
        knownElements,
        foundElements: found.get(rule) ?? 0
      }))
      .filter(
        ({ knownElements, foundElements }) => foundElements < knownElements
      )
    expect(
      fixedViolations,
      'Known accessibility violations that now fail on fewer elements. Lower their counts in this scan to the found counts, and remove a rule at zero.'
    ).toEqual([])
  }
}
