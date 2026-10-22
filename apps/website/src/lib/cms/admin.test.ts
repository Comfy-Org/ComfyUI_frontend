import { describe, expect, it } from 'vitest'
import { parsePreview } from './admin'

describe('preview cookie parsing', () => {
  it('validates view and normalizes timewarp to UTC', () => {
    expect(
      parsePreview('{"view":"DRAFT","now":"2026-10-15T09:00:00-07:00"}')
    ).toEqual({ view: 'DRAFT', now: '2026-10-15T16:00:00.000Z' })
    expect(parsePreview('{"view":"ADMIN"}')).toBeUndefined()
    expect(parsePreview('{"view":"LIVE","now":"not-a-date"}')).toBeUndefined()
    expect(parsePreview('not-json')).toBeUndefined()
    expect(parsePreview('{"view":"DRAFT","now":"2026-10-15"}')).toBeUndefined()
  })
})
