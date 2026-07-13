import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    expect(
      resolveNodeDisplayName({ title: '', type: 'CLIP Text Encode' }, options)
    ).toBe('nodeDefs.CLIP Text Encode.display_name:CLIP Text Encode')
  })

  it('falls back to the untitled label when title and type are empty', () => {
    expect(resolveNodeDisplayName({ title: '', type: '' }, options)).toBe(
      'nodeDefs.Untitled Node.display_name:Untitled Node'
    )
    expect(resolveNodeDisplayName({}, options)).toBe(
      'nodeDefs.Untitled Node.display_name:Untitled Node'
    )
  })
})
