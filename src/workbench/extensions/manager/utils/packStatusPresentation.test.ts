import { describe, expect, it } from 'vitest'

import type { PackStatusType } from '@/workbench/extensions/manager/utils/packStatusPresentation'
import { resolvePackStatusPresentation } from '@/workbench/extensions/manager/utils/packStatusPresentation'

describe('resolvePackStatusPresentation', () => {
  it.for([
    ['NodeVersionStatusActive', 'active', 'success'],
    ['NodeVersionStatusPending', 'pending', 'warning'],
    ['NodeVersionStatusFlagged', 'flagged', 'warning'],
    ['NodeVersionStatusBanned', 'banned', 'error'],
    ['NodeVersionStatusDeleted', 'deleted', 'warning'],
    ['NodeStatusActive', 'active', 'success'],
    ['NodeStatusBanned', 'banned', 'error'],
    ['NodeStatusDeleted', 'deleted', 'warning']
  ] as const)('presents %s as %s/%s', ([statusType, label, severity]) => {
    expect(resolvePackStatusPresentation({ statusType })).toEqual({
      label,
      severity
    })
  })

  it('presents flagged at a lower severity than banned', () => {
    const flagged = resolvePackStatusPresentation({
      statusType: 'NodeVersionStatusFlagged'
    })
    const banned = resolvePackStatusPresentation({
      statusType: 'NodeVersionStatusBanned'
    })

    expect(flagged.severity).toBe('warning')
    expect(banned.severity).toBe('error')
  })

  it.for([
    ['NodeVersionStatusFlagged', 'flagged', 'warning'],
    ['NodeVersionStatusBanned', 'banned', 'error'],
    ['NodeStatusBanned', 'banned', 'error']
  ] as const)(
    'keeps the %s presentation when compatibility issues are also present',
    ([statusType, label, severity]) => {
      expect(
        resolvePackStatusPresentation({
          statusType,
          hasCompatibilityIssues: true
        })
      ).toEqual({ label, severity })
    }
  )

  it('falls back to the generic conflicting label for a non-security status', () => {
    expect(
      resolvePackStatusPresentation({
        statusType: 'NodeVersionStatusActive',
        hasCompatibilityIssues: true
      })
    ).toEqual({ label: 'conflicting', severity: 'error' })
  })

  it('lets an import failure outrank every status', () => {
    expect(
      resolvePackStatusPresentation({
        statusType: 'NodeVersionStatusBanned',
        hasCompatibilityIssues: true,
        importFailed: true
      })
    ).toEqual({ label: 'importFailed', severity: 'error' })
  })

  it('falls back to unknown for an unrecognised status', () => {
    expect(
      resolvePackStatusPresentation({
        statusType: 'NotARealStatus' as PackStatusType
      })
    ).toEqual({ label: 'unknown', severity: 'secondary' })
  })
})
