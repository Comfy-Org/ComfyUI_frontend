import { describe, expect, it } from 'vitest'

import { formatWorkflowSyncErrorDetail } from './workflowSyncErrorDetail'

const translate = (key: string): string => {
  if (key === 'agent.workflowSyncFailedDetail')
    return 'Your canvas is unchanged.'
  if (key === 'agent.workflowSyncFailedDetailCatalogMismatch')
    return 'Your node catalog is incompatible.'
  return key
}

describe('formatWorkflowSyncErrorDetail', () => {
  it('falls back to the localized copy alone when there is no raw message', () => {
    expect(formatWorkflowSyncErrorDetail(translate, undefined)).toBe(
      'Your canvas is unchanged.'
    )
  })

  it('appends a short raw message as extra context after the localized copy', () => {
    expect(
      formatWorkflowSyncErrorDetail(translate, 'Expected schema 2, found 1')
    ).toBe('Your canvas is unchanged. (Expected schema 2, found 1)')
  })

  it('uses the catalog-mismatch copy when the code names that reason', () => {
    expect(
      formatWorkflowSyncErrorDetail(translate, undefined, 'catalog_mismatch')
    ).toBe('Your node catalog is incompatible.')
  })

  it('falls back to the schema-mismatch copy for an undifferentiated code', () => {
    expect(
      formatWorkflowSyncErrorDetail(
        translate,
        undefined,
        'schema_version_mismatch'
      )
    ).toBe('Your canvas is unchanged.')
  })

  it('clamps a multi-KB raw message instead of reproducing it in full', () => {
    const hugeMessage = 'x'.repeat(5000)

    const result = formatWorkflowSyncErrorDetail(translate, hugeMessage)

    expect(result.startsWith('Your canvas is unchanged. (')).toBe(true)
    // 200-char clamp plus the truncation ellipsis, well under the raw 5000.
    expect(result.length).toBeLessThan(250)
  })
})
