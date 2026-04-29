import { expect } from '@playwright/test'

import type { PerfMeasurement } from '@e2e/fixtures/helpers/PerformanceHelper'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

interface ContainCandidate {
  selector: string
  testId: string | null
  tagName: string
  className: string
  subtreeSize: number
  hasFixedWidth: boolean
  isFlexChild: boolean
  hasExplicitDimensions: boolean
  alreadyContained: boolean
  score: number
}

interface AuditResult {
  candidate: ContainCandidate
  baseline: Pick<PerfMeasurement, 'styleRecalcs' | 'layouts' | 'taskDurationMs'>
  withContain: Pick<
    PerfMeasurement,
    'styleRecalcs' | 'layouts' | 'taskDurationMs'
  >
  deltaRecalcsPct: number
  deltaLayoutsPct: number
  visuallyBroken: boolean
}

function formatPctDelta(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

function pctChange(baseline: number, measured: number): number {
  if (baseline === 0) return 0
  return ((measured - baseline) / baseline) * 100
}

const STABILIZATION_FRAMES = 60
const SETTLE_FRAMES = 10

test.describe('CSS Containment Audit', { tag: ['@audit'] }, () => {
  test('scan large graph for containment candidates', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')

    for (let i = 0; i < STABILIZATION_FRAMES; i++) {
      await comfyPage.nextFrame()
    }

    // Walk the DOM and find candidates
    const candidates = await comfyPage.page.evaluate((): ContainCandidate[] => {
      const results: ContainCandidate[] = []

      const graphContainer =
        document.querySelector('.graph-canvas-container') ??
        document.querySelector('[class*="comfy-vue-node"]')?.parentElement ??
        document.querySelector('.lg-node')?.parentElement

      const root = graphContainer ?? document.body
      const allElements = root.querySelectorAll('*')

      allElements.forEach((el) => {
        if (!(el instanceof HTMLElement)) return

        const subtreeSize = el.querySelectorAll('*').length
        if (subtreeSize < 5) return

        const computed = getComputedStyle(el)

        const containValue = computed.contain || 'none'
        const alreadyContained =
          containValue.includes('layout') || containValue.includes('strict')

        const hasFixedWidth =
          computed.width !== 'auto' &&
          !computed.width.includes('%') &&
          computed.width !== '0px'

        const isFlexChild =
          el.parentElement !== null &&
          getComputedStyle(el.parentElement).display.includes('flex') &&
          (computed.flexGrow !== '0' || computed.flexShrink !== '1')

        const hasExplicitDimensions =
          hasFixedWidth ||
          (computed.minWidth !== '0px' && computed.minWidth !== 'auto') ||
          (computed.maxWidth !== 'none' && computed.maxWidth !== '0px')

        let score = subtreeSize
        if (hasExplicitDimensions) score *= 2
        if (isFlexChild) score *= 1.5
        if (alreadyContained) score = 0

        let selector = el.tagName.toLowerCase()
        const testId = el.getAttribute('data-testid')
        if (testId) {
          selector = `[data-testid="${testId}"]`
        } else if (el.id) {
          selector = `#${el.id}`
        } else if (el.parentElement) {
          // Use nth-child to disambiguate instead of fragile first-class fallback
          // (e.g. Tailwind utilities like .flex, .relative are shared across many elements)
          const children = Array.from(el.parentElement.children)
          const index = children.indexOf(el) + 1
          const parentTestId = el.parentElement.getAttribute('data-testid')
          if (parentTestId) {
            selector = `[data-testid="${parentTestId}"] > :nth-child(${index})`
          } else if (el.parentElement.id) {
            selector = `#${el.parentElement.id} > :nth-child(${index})`
          } else {
            const tag = el.tagName.toLowerCase()
            selector = `${tag}:nth-child(${index})`
          }
        }

        results.push({
          selector,
          testId,
          tagName: el.tagName.toLowerCase(),
          className:
            typeof el.className === 'string' ? el.className.slice(0, 80) : '',
          subtreeSize,
          hasFixedWidth,
          isFlexChild,
          hasExplicitDimensions,
          alreadyContained,
          score
        })
      })

      results.sort((a, b) => b.score - a.score)
      return results.slice(0, 20)
    })

    console.log(`\nFound ${candidates.length} containment candidates\n`)

    // Deduplicate candidates by selector (keep highest score)
    const seen = new Set<string>()
    const uniqueCandidates = candidates.filter((c) => {
      if (seen.has(c.selector)) return false
      seen.add(c.selector)
      return true
    })

    // Measure baseline performance (idle)
    await comfyPage.perf.startMeasuring()
    for (let i = 0; i < STABILIZATION_FRAMES; i++) {
      await comfyPage.nextFrame()
    }
    const baseline = await comfyPage.perf.stopMeasuring('baseline-idle')

    // Take a baseline screenshot for visual comparison
    const baselineScreenshot = await comfyPage.page.screenshot()

    // For each candidate, apply contain and measure
    const results: AuditResult[] = []

    const testCandidates = uniqueCandidates
      .filter((c) => !c.alreadyContained && c.score > 0)
      .slice(0, 10)

    for (const candidate of testCandidates) {
      const applied = await comfyPage.page.evaluate((sel: string) => {
        const elements = document.querySelectorAll(sel)
        let count = 0
        elements.forEach((el) => {
          if (el instanceof HTMLElement) {
            el.style.contain = 'layout style'
            count++
          }
        })
        return count
      }, candidate.selector)

      if (applied === 0) continue

      for (let i = 0; i < SETTLE_FRAMES; i++) {
        await comfyPage.nextFrame()
      }

      // Measure with containment
      await comfyPage.perf.startMeasuring()
      for (let i = 0; i < STABILIZATION_FRAMES; i++) {
        await comfyPage.nextFrame()
      }
      const withContain = await comfyPage.perf.stopMeasuring(
        `contain-${candidate.selector}`
      )

      // Take screenshot with containment applied to detect visual breakage.
      // Note: PNG byte comparison can produce false positives from subpixel
      // rendering and anti-aliasing. Treat "DIFF" as "needs manual review".
      const containScreenshot = await comfyPage.page.screenshot()
      const visuallyBroken = !baselineScreenshot.equals(containScreenshot)

      // Remove containment
      await comfyPage.page.evaluate((sel: string) => {
        document.querySelectorAll(sel).forEach((el) => {
          if (el instanceof HTMLElement) {
            el.style.contain = ''
          }
        })
      }, candidate.selector)

      for (let i = 0; i < SETTLE_FRAMES; i++) {
        await comfyPage.nextFrame()
      }

      results.push({
        candidate,
        baseline: {
          styleRecalcs: baseline.styleRecalcs,
          layouts: baseline.layouts,
          taskDurationMs: baseline.taskDurationMs
        },
        withContain: {
          styleRecalcs: withContain.styleRecalcs,
          layouts: withContain.layouts,
          taskDurationMs: withContain.taskDurationMs
        },
        deltaRecalcsPct: pctChange(
          baseline.styleRecalcs,
          withContain.styleRecalcs
        ),
        deltaLayoutsPct: pctChange(baseline.layouts, withContain.layouts),
        visuallyBroken
      })
    }

    // Print the report
    const divider = '='.repeat(100)
    const thinDivider = '-'.repeat(100)
    console.log('\n')
    console.log('CSS Containment Audit Results')
    console.log(divider)
    console.log(
      'Rank | Selector                                   | Subtree | Score | DRecalcs   | DLayouts   | Visual'
    )
    console.log(thinDivider)

    results
      .sort((a, b) => a.deltaRecalcsPct - b.deltaRecalcsPct)
      .forEach((r, i) => {
        const sel = r.candidate.selector.padEnd(42)
        const sub = String(r.candidate.subtreeSize).padStart(7)
        const score = String(Math.round(r.candidate.score)).padStart(5)
        const dr = formatPctDelta(r.deltaRecalcsPct)
        const dl = formatPctDelta(r.deltaLayoutsPct)
        const vis = r.visuallyBroken ? 'DIFF' : 'OK'
        console.log(
          `  ${String(i + 1).padStart(2)}  | ${sel} | ${sub} | ${score} | ${dr.padStart(10)} | ${dl.padStart(10)} | ${vis}`
        )
      })

    console.log(divider)
    console.log(
      `\nBaseline: ${baseline.styleRecalcs} style recalcs, ${baseline.layouts} layouts, ${baseline.taskDurationMs.toFixed(1)}ms task duration\n`
    )

    const alreadyContained = uniqueCandidates.filter((c) => c.alreadyContained)
    if (alreadyContained.length > 0) {
      console.log('Already contained elements:')
      alreadyContained.forEach((c) => {
        console.log(`  ${c.selector} (subtree: ${c.subtreeSize})`)
      })
    }

    expect(results.length).toBeGreaterThan(0)
  })

  // Pan interaction perf measurement removed — covered by PR #10001 (performance.spec.ts).
  // The containment fix itself is tracked in PR #9946.
})
