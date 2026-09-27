import { describe, expect, it } from 'vitest'

import { setNewestPreview } from './modelPreviewSelection'

describe('setNewestPreview', () => {
  it('selects the workflow with the newest publication date', () => {
    const target = {}

    setNewestPreview(target, 'older-workflow', {
      timestamp: Date.parse('2026-01-01'),
      index: 0
    })
    setNewestPreview(target, 'newer-workflow', {
      timestamp: Date.parse('2026-08-01'),
      index: 10
    })

    expect(target).toMatchObject({ previewTemplate: 'newer-workflow' })
  })

  it('uses workflow index order when publication dates match', () => {
    const target = {}

    setNewestPreview(target, 'later-index-entry', {
      timestamp: Date.parse('2026-08-01'),
      index: 10
    })
    setNewestPreview(target, 'earlier-index-entry', {
      timestamp: Date.parse('2026-08-01'),
      index: 2
    })

    expect(target).toMatchObject({ previewTemplate: 'earlier-index-entry' })
  })
})
