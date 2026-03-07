import { describe, expect, it } from 'vitest'

import type { ConflictDetail } from '@/workbench/extensions/manager/types/conflictDetectionTypes'

import {
  getConflictMessage,
  getJoinedConflictMessages
} from '@/workbench/extensions/manager/utils/conflictMessageUtil'

function mockT(key: string, params?: Record<string, unknown>): string {
  if (params) {
    return `${key}|current=${params.current},required=${params.required}`
  }
  return key
}

function makeConflict(
  type: string,
  current?: string,
  required?: string
): ConflictDetail {
  return {
    type,
    current_value: current,
    required_value: required
  } as unknown as ConflictDetail
}

describe('getConflictMessage', () => {
  it('returns interpolated message for comfyui_version conflict', () => {
    const result = getConflictMessage(
      makeConflict('comfyui_version', '1.0', '2.0'),
      mockT
    )
    expect(result).toBe(
      'manager.conflicts.conflictMessages.comfyui_version|current=1.0,required=2.0'
    )
  })

  it('returns interpolated message for frontend_version conflict', () => {
    const result = getConflictMessage(
      makeConflict('frontend_version', '1.0', '2.0'),
      mockT
    )
    expect(result).toContain('frontend_version')
  })

  it('returns simple message for banned conflict', () => {
    const result = getConflictMessage(makeConflict('banned'), mockT)
    expect(result).toBe('manager.conflicts.conflictMessages.banned')
  })

  it('returns simple message for pending conflict', () => {
    const result = getConflictMessage(makeConflict('pending'), mockT)
    expect(result).toBe('manager.conflicts.conflictMessages.pending')
  })

  it('returns generic message for unknown conflict type', () => {
    const result = getConflictMessage(
      makeConflict('unknown_type', 'a', 'b'),
      mockT
    )
    expect(result).toContain('generic')
  })
})

describe('getJoinedConflictMessages', () => {
  it('joins multiple conflict messages with default separator', () => {
    const conflicts = [makeConflict('banned'), makeConflict('pending')]
    const result = getJoinedConflictMessages(conflicts, mockT)
    expect(result).toBe(
      'manager.conflicts.conflictMessages.banned; manager.conflicts.conflictMessages.pending'
    )
  })

  it('uses custom separator', () => {
    const conflicts = [makeConflict('banned'), makeConflict('pending')]
    const result = getJoinedConflictMessages(conflicts, mockT, ' | ')
    expect(result).toContain(' | ')
  })
})
