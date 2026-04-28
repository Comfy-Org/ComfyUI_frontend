import { describe, expect, it, vi } from 'vitest'

import { useAssetIngest } from './useAssetIngest'

function mockFile(name: string, type = 'image/png', size = 10): File {
  return new File([new Uint8Array(size)], name, { type })
}

describe('useAssetIngest', () => {
  it('uses uploader result path when upload succeeds', async () => {
    const uploader = vi.fn().mockResolvedValue('/input/sub/foo.png')
    const { ingestFile } = useAssetIngest({ uploader })
    const result = await ingestFile(mockFile('foo.png'))
    expect(result.remote).toBe(true)
    expect(result.asset.path).toBe('/input/sub/foo.png')
    expect(result.asset.mime).toBe('image/png')
  })

  it('falls back to /tmp/pasted when uploader returns null', async () => {
    const uploader = vi.fn().mockResolvedValue(null)
    const { ingestFile } = useAssetIngest({ uploader })
    const result = await ingestFile(mockFile('x.png'))
    expect(result.remote).toBe(false)
    expect(result.asset.path).toMatch(/^\/tmp\/pasted\//)
  })

  it('sanitizes filenames', async () => {
    const uploader = vi.fn().mockResolvedValue(null)
    const { ingestFile } = useAssetIngest({ uploader })
    const result = await ingestFile(mockFile('weird name !@#.png'))
    expect(result.asset.path).not.toMatch(/[!@#]/)
  })

  it('creates preview URL for images only', async () => {
    const uploader = vi.fn().mockResolvedValue(null)
    const { ingestFile } = useAssetIngest({ uploader })
    const img = await ingestFile(mockFile('a.png', 'image/png'))
    const txt = await ingestFile(mockFile('a.txt', 'text/plain'))
    expect(img.asset.previewUrl).toBeDefined()
    expect(txt.asset.previewUrl).toBeUndefined()
  })

  it('ingests multiple files from DataTransfer', async () => {
    const uploader = vi.fn().mockResolvedValue('/input/x')
    const { ingestFromClipboard } = useAssetIngest({ uploader })
    const dt = {
      items: [
        { kind: 'file', getAsFile: () => mockFile('a.png') },
        { kind: 'file', getAsFile: () => mockFile('b.png') },
        { kind: 'string', getAsFile: () => null }
      ],
      files: []
    } as unknown as DataTransfer
    const results = await ingestFromClipboard(dt)
    expect(results).toHaveLength(2)
  })

  it('returns empty list when DataTransfer is null', async () => {
    const { ingestFromClipboard } = useAssetIngest({})
    expect(await ingestFromClipboard(null)).toEqual([])
  })
})
