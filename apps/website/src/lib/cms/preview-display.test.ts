import { describe, expect, it } from 'vitest'
import {
  formatPreviewUtc,
  parseUtcInput,
  safeInternalPath,
  utcInput
} from './preview-display'

describe('preview display boundaries', () => {
  it.for([
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/%5cevil.test',
    '/%2fevil.test',
    '/bad%0apath',
    '/invalid%',
    '/.//evil.com',
    '/a/..//evil.com',
    '/%2e//evil.com'
  ])('refuses unsafe navigation %s', (path) => {
    expect(safeInternalPath(path)).toBeUndefined()
  })
  it('preserves a valid internal path without inventing a UID mapping', () => {
    expect(safeInternalPath('/hub/workflows/example/?preview=1#inputs')).toBe(
      '/hub/workflows/example/?preview=1#inputs'
    )
  })
  it('parses explicit UTC, including daylight-saving boundaries without browser timezone assumptions', () => {
    expect(parseUtcInput('2026-11-01T01:30')).toBe('2026-11-01T01:30:00.000Z')
    expect(utcInput('2026-11-01T01:30:00Z')).toBe('2026-11-01T01:30')
    expect(formatPreviewUtc('2026-11-01T01:30:00Z', 'en')).toContain('UTC')
  })
  it.for(['2026-02-30T09:00', '2026-10-10T25:00', '2026-10-10', '', 'invalid'])(
    'refuses invalid calendar value %s',
    (value) => {
      expect(parseUtcInput(value)).toBeUndefined()
    }
  )
  it('does not render invalid timestamps', () => {
    expect(utcInput('invalid')).toBe('')
    expect(formatPreviewUtc('invalid', 'en')).toBe('')
  })
})
