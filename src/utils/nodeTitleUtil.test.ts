import { beforeEach, describe, expect, it, vi } from 'vitest'

import { normalizeI18nKey } from '@/utils/formatUtil'
import { resolveNodeDisplayName } from '@/utils/nodeTitleUtil'

const options = {
  emptyLabel: 'Empty Node',
  untitledLabel: 'Untitled Node',
  st: vi.fn((key: string, fallback: string) => `${key}:${fallback}`)
}

describe('resolveNodeDisplayName', () => {
  beforeEach(() => {
    options.st.mockClear()
  })

  it('uses the empty label when no node is available', () => {
    expect(resolveNodeDisplayName(null, options)).toBe('Empty Node')
    expect(resolveNodeDisplayName(undefined, options)).toBe('Empty Node')
    expect(options.st).not.toHaveBeenCalled()
  })

  it('prefers a trimmed explicit title', () => {
    expect(
      resolveNodeDisplayName(
        { title: '  KSampler  ', type: 'Ignored' },
        options
      )
    ).toBe('KSampler')
    expect(options.st).not.toHaveBeenCalled()
  })

  it('translates the node type when the title is empty', () => {
    const result = resolveNodeDisplayName(
      { title: '', type: 'CLIP Text Encode' },
      options
    )
    const expectedKey = `nodeDefs.${normalizeI18nKey('CLIP Text Encode')}.display_name`
    expect(options.st).toHaveBeenCalledWith(expectedKey, 'CLIP Text Encode')
    expect(result).toBe(`${expectedKey}:CLIP Text Encode`)
  })

  it('falls back to the untitled label when title and type are empty', () => {
    const expectedKey = `nodeDefs.${normalizeI18nKey('Untitled Node')}.display_name`
    expect(resolveNodeDisplayName({ title: '', type: '' }, options)).toBe(
      `${expectedKey}:Untitled Node`
    )
    expect(resolveNodeDisplayName({}, options)).toBe(
      `${expectedKey}:Untitled Node`
    )
  })
})
