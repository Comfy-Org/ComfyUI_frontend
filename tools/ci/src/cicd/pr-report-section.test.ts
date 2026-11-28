import { describe, expect, it } from 'vitest'

import { renderPrReportSection } from './pr-report-section'

describe('renderPrReportSection', () => {
  it.for([
    { name: 'omitted', body: undefined },
    { name: 'empty', body: '' },
    { name: 'whitespace only', body: '\n  \n' }
  ])('emits no collapsed box when the body is $name', ({ body }) => {
    const rendered = renderPrReportSection({
      icon: '🔬',
      title: 'E2E Coverage',
      status: '🟡 66.3%',
      body
    })

    expect(rendered).toBe('## 🔬 E2E Coverage: 🟡 66.3%')
  })

  it('folds the body into a collapsed box behind the heading', () => {
    expect(
      renderPrReportSection({
        icon: '🔬',
        title: 'E2E Coverage',
        status: '🟡 66.3% of lines',
        body: '| Metric | Pct |\n|---|---|\n| Lines | 66.3% |'
      })
    ).toBe(
      `## 🔬 E2E Coverage: 🟡 66.3% of lines

<details>
<summary>Details</summary>

| Metric | Pct |
|---|---|
| Lines | 66.3% |

</details>`
    )
  })

  it('strips body padding so nested sections do not drift apart', () => {
    expect(
      renderPrReportSection({
        icon: '🌾',
        title: 'Fallow',
        status: '✅ Passed',
        body: '\n\nNo new findings.\n\n\n'
      })
    ).toBe(
      '## 🌾 Fallow: ✅ Passed\n\n<details>\n<summary>Details</summary>\n\nNo new findings.\n\n</details>'
    )
  })

  it('keeps the notice visible between the heading and the collapsed box', () => {
    const rendered = renderPrReportSection({
      icon: '⚡',
      title: 'Performance',
      status: '❌ 1 below 52 FPS target',
      notice: '> ❌ **1 scenario below the target.** Profile it.',
      body: '| Metric | Value |'
    })

    expect(rendered.split('<details>')[0]).toBe(
      '## ⚡ Performance: ❌ 1 below 52 FPS target\n\n> ❌ **1 scenario below the target.** Profile it.\n\n'
    )
    expect(rendered).toContain('<summary>Details</summary>\n\n| Metric')
  })

  it('renders a notice without a box when there is no body', () => {
    expect(
      renderPrReportSection({
        icon: '🔬',
        title: 'E2E Coverage',
        status: '⚠️ No line coverage recorded',
        notice: '\n> [!NOTE]\n> Check the logs.\n'
      })
    ).toBe(
      '## 🔬 E2E Coverage: ⚠️ No line coverage recorded\n\n> [!NOTE]\n> Check the logs.'
    )
  })

  it('names the collapsed box when a summary is given', () => {
    expect(
      renderPrReportSection({
        icon: '🔬',
        title: 'E2E Coverage',
        status: '🟢 90.0% of lines',
        summary: 'Coverage totals',
        body: '| Metric |'
      })
    ).toContain(
      '<summary>Coverage totals</summary>\n\n| Metric |\n\n</details>'
    )
  })
})
