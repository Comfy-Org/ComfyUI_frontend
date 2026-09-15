import { describe, expect, it } from 'vitest'

import type { PackStatusType } from '@/workbench/extensions/manager/utils/packStatusPresentation'
import { resolvePackStatusPresentation } from '@/workbench/extensions/manager/utils/packStatusPresentation'

describe('resolvePackStatusPresentation', () => {
  it.for([
    ['NodeVersionStatusActive', 'active', 'success'],
    ['NodeVersionStatusPending', 'pending', 'warn'],
    ['NodeVersionStatusFlagged', 'flagged', 'warn'],
    ['NodeVersionStatusBanned', 'banned', 'error'],
    ['NodeVersionStatusDeleted', 'deleted', 'warn'],
    ['NodeStatusActive', 'active', 'success'],
    ['NodeStatusBanned', 'banned', 'error'],
    ['NodeStatusDeleted', 'deleted', 'warn']
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

    expect(flagged.severity).toBe('warn')
    expect(banned.severity).toBe('error')
  })

  it.for([
    ['NodeVersionStatusFlagged', 'flagged'],
    ['NodeVersionStatusBanned', 'banned'],
    ['NodeStatusBanned', 'banned']
  ] as const)(
    'keeps the %s label when compatibility issues are also present',
    ([statusType, label]) => {
      expect(
        resolvePackStatusPresentation({
          statusType,
          hasCompatibilityIssues: true
        }).label
      ).toBe(label)
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
