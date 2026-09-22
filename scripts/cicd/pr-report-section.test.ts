import { describe, expect, it } from 'vitest'

import { renderPrReportSection } from './pr-report-section'

describe('renderPrReportSection', () => {
  it('renders the verdict on the heading', () => {
    expect(
      renderPrReportSection({
        icon: '⚡',
        title: 'Performance',
        status: '✅ No regressions'
      })
    ).toBe('## ⚡ Performance: ✅ No regressions')
  })

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

  it('keeps a blank line between the tags and the body so GitHub parses it', () => {
    const lines = renderPrReportSection({
      icon: '📦',
      title: 'Bundle',
      status: '9.96 MB gzip',
      body: '**Summary**'
    }).split('\n')

    expect(lines[lines.indexOf('<summary>Details</summary>') + 1]).toBe('')
    expect(lines[lines.indexOf('</details>') - 1]).toBe('')
  })

  it('leaves a blank line before the next section once blocks are joined', () => {
    // upsert-comment-section concatenates section blocks with a blank line.
    // Without one, the HTML block opened by </details> runs on and swallows
    // the following `##` into plain text.
    const bundle = renderPrReportSection({
      icon: '📦',
      title: 'Bundle',
      status: '9.96 MB gzip',
      body: '**Summary**'
    })
    const perf = renderPrReportSection({
      icon: '⚡',
      title: 'Performance',
      status: '✅ No regressions'
    })

    expect(bundle.endsWith('</details>')).toBe(true)
    expect(`${bundle}\n\n${perf}`).toContain('</details>\n\n## ⚡')
  })

  it('strips body padding so nested sections do not drift apart', () => {
    expect(
      renderPrReportSection({
        icon: '🌾',
        title: 'Fallow',
        status: '✅ Passed',
        body: '\n\nNo new findings.\n\n\n'
      })
    ).toContain('\n\nNo new findings.\n\n</details>')
  })
})
