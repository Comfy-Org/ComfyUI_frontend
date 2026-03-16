import { expect } from '@playwright/test'

import type { PerfMeasurement } from '../fixtures/helpers/PerformanceHelper'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

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

test.describe('CSS Containment Audit', { tag: ['@audit'] }, () => {
  test('scan large graph for containment candidates', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')

    for (let i = 0; i < 60; i++) {
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
        } else if (el.className && typeof el.className === 'string') {
          const firstClass = el.className.split(' ')[0]
          if (firstClass) selector = `.${firstClass}`
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
    for (let i = 0; i < 60; i++) {
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

      for (let i = 0; i < 10; i++) {
        await comfyPage.nextFrame()
      }

      // Measure with containment
      await comfyPage.perf.startMeasuring()
      for (let i = 0; i < 60; i++) {
        await comfyPage.nextFrame()
      }
      const withContain = await comfyPage.perf.stopMeasuring(
        `contain-${candidate.selector}`
      )

      // Take screenshot with containment applied to detect visual breakage
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

      for (let i = 0; i < 10; i++) {
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
        const vis = r.visuallyBroken ? 'BREAK' : 'OK'
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

  test('measure containment impact with pan interaction', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')

    for (let i = 0; i < 60; i++) {
      await comfyPage.nextFrame()
    }

    const canvas = comfyPage.canvas
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas bounding box not available')

    async function measurePan(label: string): Promise<PerfMeasurement> {
      await comfyPage.perf.startMeasuring()
      const centerX = box!.x + box!.width / 2
      const centerY = box!.y + box!.height / 2
      await comfyPage.page.mouse.move(centerX, centerY)
      await comfyPage.page.mouse.down({ button: 'middle' })
      for (let j = 0; j < 60; j++) {
        await comfyPage.page.mouse.move(centerX + j * 5, centerY + j * 2)
        await comfyPage.nextFrame()
      }
      await comfyPage.page.mouse.up({ button: 'middle' })
      return comfyPage.perf.stopMeasuring(label)
    }

    const baselinePan = await measurePan('baseline-pan')

    // Find elements without containment that have large subtrees
    const candidates = await comfyPage.page.evaluate(() => {
      const results: Array<{ selector: string; subtreeSize: number }> = []

      const nodeWrappers = document.querySelectorAll(
        '[data-testid="node-inner-wrapper"]'
      )
      if (nodeWrappers.length > 0) {
        const sample = nodeWrappers[0]
        const subtreeSize = sample.querySelectorAll('*').length
        const computed = getComputedStyle(sample)
        const containValue = computed.contain || 'none'
        if (!containValue.includes('layout')) {
          results.push({
            selector: '[data-testid="node-inner-wrapper"]',
            subtreeSize
          })
        }
      }

      const nodeBodies = document.querySelectorAll('[data-testid^="node-body"]')
      if (nodeBodies.length > 0) {
        const sample = nodeBodies[0]
        const subtreeSize = sample.querySelectorAll('*').length
        const computed = getComputedStyle(sample)
        const containValue = computed.contain || 'none'
        if (!containValue.includes('layout')) {
          results.push({
            selector: '[data-testid^="node-body"]',
            subtreeSize
          })
        }
      }

      const lgNodes = document.querySelectorAll('.lg-node')
      if (lgNodes.length > 0) {
        const sample = lgNodes[0]
        const subtreeSize = sample.querySelectorAll('*').length
        const computed = getComputedStyle(sample)
        const containValue = computed.contain || 'none'
        if (!containValue.includes('layout')) {
          results.push({
            selector: '.lg-node',
            subtreeSize
          })
        }
      }

      return results
    })

    const divider = '='.repeat(90)
    const thinDivider = '-'.repeat(90)
    console.log('\n')
    console.log('Pan Interaction Containment Impact')
    console.log(divider)
    console.log(
      `Baseline pan: ${baselinePan.styleRecalcs} recalcs, ${baselinePan.layouts} layouts, ${baselinePan.taskDurationMs.toFixed(1)}ms task, ${baselinePan.durationMs.toFixed(1)}ms total`
    )
    console.log(thinDivider)

    for (const candidate of candidates) {
      await comfyPage.page.evaluate((sel: string) => {
        document.querySelectorAll(sel).forEach((el) => {
          if (el instanceof HTMLElement) el.style.contain = 'layout style'
        })
      }, candidate.selector)

      for (let i = 0; i < 10; i++) {
        await comfyPage.nextFrame()
      }

      const panResult = await measurePan(`pan-${candidate.selector}`)

      console.log(
        `\n${candidate.selector} (subtree: ${candidate.subtreeSize}, applied to all matching):`
      )
      console.log(
        `  Recalcs: ${baselinePan.styleRecalcs} -> ${panResult.styleRecalcs} (${formatPctDelta(pctChange(baselinePan.styleRecalcs, panResult.styleRecalcs))})`
      )
      console.log(
        `  Layouts: ${baselinePan.layouts} -> ${panResult.layouts} (${formatPctDelta(pctChange(baselinePan.layouts, panResult.layouts))})`
      )
      console.log(
        `  Task:    ${baselinePan.taskDurationMs.toFixed(1)}ms -> ${panResult.taskDurationMs.toFixed(1)}ms (${formatPctDelta(pctChange(baselinePan.taskDurationMs, panResult.taskDurationMs))})`
      )
      console.log(
        `  Duration: ${baselinePan.durationMs.toFixed(1)}ms -> ${panResult.durationMs.toFixed(1)}ms total`
      )

      await comfyPage.page.evaluate((sel: string) => {
        document.querySelectorAll(sel).forEach((el) => {
          if (el instanceof HTMLElement) el.style.contain = ''
        })
      }, candidate.selector)

      for (let i = 0; i < 10; i++) {
        await comfyPage.nextFrame()
      }
    }

    console.log('\n' + divider)
    expect(true).toBe(true)
  })
})
