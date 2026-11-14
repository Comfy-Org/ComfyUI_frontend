import { assert, describe, expect, it } from 'vitest'

import {
  DOCK_PREVIEW_CHARS,
  DOCK_TITLE_CHARS,
  MATCH_LINE_CHARS,
  WORKFLOW_TAIL_CHARS,
  WORKFLOW_TAIL_MIN_CHARS,
  matchWindow,
  planChatRow,
  splitByRanges
} from './chatHistoryRowText'

const matchedText = (parts: { text: string; highlighted: boolean }[]) =>
  parts.filter((p) => p.highlighted).map((p) => p.text)
const joined = (parts: { text: string }[]) => parts.map((p) => p.text).join('')

describe('splitByRanges', () => {
  it('returns one plain segment without ranges', () => {
    expect(splitByRanges('hello', [])).toEqual([
      { text: 'hello', highlighted: false }
    ])
  })

  it('splits plain / matched / plain', () => {
    expect(splitByRanges('hello world', [{ start: 6, end: 11 }])).toEqual([
      { text: 'hello ', highlighted: false },
      { text: 'world', highlighted: true }
    ])
  })

  it('keeps adjacent ranges as separate matched segments in order', () => {
    const parts = splitByRanges('abcdef', [
      { start: 1, end: 3 },
      { start: 3, end: 5 }
    ])
    expect(joined(parts)).toBe('abcdef')
    expect(matchedText(parts).join('')).toBe('bcde')
  })

  it('tolerates overlapping and unsorted ranges without duplicating text', () => {
    const parts = splitByRanges('abcdef', [
      { start: 3, end: 6 },
      { start: 1, end: 4 }
    ])
    expect(joined(parts)).toBe('abcdef')
    expect(matchedText(parts).join('')).toBe('bcdef')
  })

  it('ignores empty and out-of-range ranges and clamps to the text', () => {
    const parts = splitByRanges('abc', [
      { start: 1, end: 1 },
      { start: 2, end: 99 },
      { start: 50, end: 60 }
    ])
    expect(joined(parts)).toBe('abc')
    expect(matchedText(parts)).toEqual(['c'])
  })

  it('returns no segments for empty text', () => {
    expect(splitByRanges('', [{ start: 0, end: 2 }])).toEqual([])
  })

  it('keeps markup-like text verbatim', () => {
    const parts = splitByRanges('a <b>x</b>', [{ start: 2, end: 5 }])
    expect(matchedText(parts)).toEqual(['<b>'])
    expect(joined(parts)).toBe('a <b>x</b>')
  })
})

describe('matchWindow', () => {
  it('returns short text whole', () => {
    const parts = matchWindow('short text', [{ start: 6, end: 10 }])
    expect(joined(parts)).toBe('short text')
    expect(matchedText(parts)).toEqual(['text'])
  })

  it('windows long text around the match with ellipses', () => {
    const text = `${'a'.repeat(100)}NEEDLE${'b'.repeat(100)}`
    const parts = matchWindow(text, [{ start: 100, end: 106 }])
    const out = joined(parts)
    expect(out.length).toBeLessThanOrEqual(MATCH_LINE_CHARS + 2)
    expect(out.startsWith('…')).toBe(true)
    expect(out.endsWith('…')).toBe(true)
    expect(matchedText(parts)).toEqual(['NEEDLE'])
  })

  it('omits the leading ellipsis for a match at the start', () => {
    const parts = matchWindow(`NEEDLE${'b'.repeat(100)}`, [
      { start: 0, end: 6 }
    ])
    expect(joined(parts).startsWith('NEEDLE')).toBe(true)
    expect(joined(parts).endsWith('…')).toBe(true)
  })
})

describe('planChatRow', () => {
  const base = {
    title: 'Weekly plan',
    ranges: {},
    current: false
  }

  it('has no match line and no highlights without ranges', () => {
    const plan = planChatRow({ ...base, preview: 'hello' })
    expect(plan.matchLine).toBeUndefined()
    expect(matchedText(plan.titleParts)).toEqual([])
  })

  it('highlights a visible title match without a match line', () => {
    const plan = planChatRow({
      ...base,
      ranges: { title: [{ start: 7, end: 11 }] }
    })
    expect(matchedText(plan.titleParts)).toEqual(['plan'])
    expect(plan.matchLine).toBeUndefined()
  })

  it('shows a Title match line when the match is beyond the title budget', () => {
    const title = `${'x'.repeat(DOCK_TITLE_CHARS)} needle`
    const plan = planChatRow({
      ...base,
      title,
      ranges: { title: [{ start: title.length - 6, end: title.length }] }
    })
    expect(plan.matchLine?.field).toBe('title')
    assert.exists(plan.matchLine)
    expect(matchedText(plan.matchLine.parts)).toEqual(['needle'])
  })

  it('treats a title match ending exactly at the budget as visible', () => {
    const title = 'x'.repeat(DOCK_TITLE_CHARS + 10)
    const plan = planChatRow({
      ...base,
      title,
      ranges: {
        title: [{ start: DOCK_TITLE_CHARS - 3, end: DOCK_TITLE_CHARS }]
      }
    })
    expect(plan.matchLine).toBeUndefined()
  })

  it('shows a Message match line when the preview match is beyond its budget', () => {
    const preview = `${'y'.repeat(DOCK_PREVIEW_CHARS + 5)}needle`
    const plan = planChatRow({
      ...base,
      preview,
      ranges: {
        preview: [{ start: preview.length - 6, end: preview.length }]
      }
    })
    expect(plan.matchLine?.field).toBe('preview')
    assert.exists(plan.matchLine)
    expect(matchedText(plan.matchLine.parts)).toEqual(['needle'])
    expect(plan.previewParts).toBeUndefined()
  })

  it('keeps the preview with highlights when the match is visible', () => {
    const plan = planChatRow({
      ...base,
      preview: 'Help me plan the week',
      ranges: { preview: [{ start: 8, end: 12 }] }
    })
    assert.exists(plan.previewParts)
    expect(matchedText(plan.previewParts)).toEqual(['plan'])
    expect(plan.matchLine).toBeUndefined()
  })

  it('highlights a workflow match in the tail when it survives the ellipsis', () => {
    const plan = planChatRow({
      ...base,
      workflowName: 'Portrait upscale',
      ranges: { workflowName: [{ start: 0, end: 8 }] }
    })
    assert.exists(plan.workflowParts)
    expect(matchedText(plan.workflowParts)).toEqual(['Portrait'])
    expect(plan.matchLine).toBeUndefined()
  })

  it('shows the long workflow name middle-truncated to the tail budget', () => {
    const name = 'Portrait upscale final (copy 2)'
    const plan = planChatRow({ ...base, workflowName: name })
    assert.exists(plan.workflowParts)
    expect(joined(plan.workflowParts)).toHaveLength(WORKFLOW_TAIL_CHARS)
    assert.exists(plan.workflowParts)
    expect(joined(plan.workflowParts)).toContain('…')
  })

  it('shrinks the tail to the minimum while the current marker is shown', () => {
    const plan = planChatRow({
      ...base,
      current: true,
      workflowName: 'Portrait upscale final (copy 2)'
    })
    assert.exists(plan.workflowParts)
    expect(joined(plan.workflowParts)).toHaveLength(WORKFLOW_TAIL_MIN_CHARS)
  })

  it('shifts the tail window to keep a workflow match visible', () => {
    const name = 'Portrait upscale final (copy 2)'
    const start = name.indexOf('copy')
    const plan = planChatRow({
      ...base,
      workflowName: name,
      ranges: { workflowName: [{ start, end: start + 4 }] }
    })
    assert.exists(plan.workflowParts)
    expect(matchedText(plan.workflowParts)).toEqual(['copy'])
    expect(plan.matchLine).toBeUndefined()
  })

  it('falls back to a Workflow match line when the match is cut from the tail', () => {
    const name = 'Portrait upscale final (copy 2)'
    const plan = planChatRow({
      ...base,
      workflowName: name,
      ranges: { workflowName: [{ start: 0, end: name.length - 1 }] }
    })
    expect(plan.matchLine?.field).toBe('workflowName')
  })

  it('omits the tail without a workflow name', () => {
    expect(planChatRow({ ...base }).workflowParts).toBeUndefined()
    expect(planChatRow({ ...base, workflowName: '' }).workflowParts).toBe(
      undefined
    )
  })

  it('picks one match line by priority: title, then workflow, then preview', () => {
    const longTitle = `${'t'.repeat(DOCK_TITLE_CHARS)}needle`
    const longPreview = `${'p'.repeat(DOCK_PREVIEW_CHARS)}needle`
    const cutWorkflow = 'needle'.repeat(6)
    const ranges = (text: string) => [
      { start: text.length - 6, end: text.length }
    ]
    const all = planChatRow({
      ...base,
      title: longTitle,
      preview: longPreview,
      workflowName: cutWorkflow,
      ranges: {
        title: ranges(longTitle),
        preview: ranges(longPreview),
        workflowName: [{ start: 0, end: cutWorkflow.length - 1 }]
      }
    })
    expect(all.matchLine?.field).toBe('title')

    const noTitle = planChatRow({
      ...base,
      preview: longPreview,
      workflowName: cutWorkflow,
      ranges: {
        preview: ranges(longPreview),
        workflowName: [{ start: 0, end: cutWorkflow.length - 1 }]
      }
    })
    expect(noTitle.matchLine?.field).toBe('workflowName')
  })

  it('shifts title ranges when the title is trimmed for display', () => {
    const plan = planChatRow({
      ...base,
      title: '  Weekly plan',
      ranges: { title: [{ start: 9, end: 13 }] }
    })
    expect(joined(plan.titleParts)).toBe('Weekly plan')
    expect(matchedText(plan.titleParts)).toEqual(['plan'])
  })
})
