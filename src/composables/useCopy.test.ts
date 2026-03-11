import { describe, expect, it } from 'vitest'

/**
 * Encodes a UTF-8 string to base64 (same logic as useCopy.ts)
 */
function encodeClipboardData(data: string): string {
  return btoa(
    String.fromCharCode(...Array.from(new TextEncoder().encode(data)))
  )
}

/**
 * Decodes base64 to UTF-8 string (same logic as usePaste.ts)
 */
function decodeClipboardData(base64: string): string {
  const binaryString = atob(base64)
  const bytes = Uint8Array.from(binaryString, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

describe('Clipboard UTF-8 base64 encoding/decoding', () => {
  it('should handle ASCII-only strings', () => {
    const original = '{"nodes":[{"id":1,"type":"LoadImage"}]}'
    const encoded = encodeClipboardData(original)
    const decoded = decodeClipboardData(encoded)
    expect(decoded).toBe(original)
  })

  it('should handle Chinese characters in localized_name', () => {
    const original =
      '{"nodes":[{"id":1,"type":"LoadImage","localized_name":"图像"}]}'
    const encoded = encodeClipboardData(original)
    const decoded = decodeClipboardData(encoded)
    expect(decoded).toBe(original)
  })

  it('should handle Japanese characters', () => {
    const original = '{"localized_name":"画像を読み込む"}'
    const encoded = encodeClipboardData(original)
    const decoded = decodeClipboardData(encoded)
    expect(decoded).toBe(original)
  })

  it('should handle Korean characters', () => {
    const original = '{"localized_name":"이미지 불러오기"}'
    const encoded = encodeClipboardData(original)
    const decoded = decodeClipboardData(encoded)
    expect(decoded).toBe(original)
  })

  it('should handle mixed ASCII and Unicode characters', () => {
    const original =
      '{"nodes":[{"id":1,"type":"LoadImage","localized_name":"加载图像","label":"Load Image 图片"}]}'
    const encoded = encodeClipboardData(original)
    const decoded = decodeClipboardData(encoded)
    expect(decoded).toBe(original)
  })

  it('should handle emoji characters', () => {
    const original = '{"title":"Test Node 🎨🖼️"}'
    const encoded = encodeClipboardData(original)
    const decoded = decodeClipboardData(encoded)
    expect(decoded).toBe(original)
  })

  it('should handle empty string', () => {
    const original = ''
    const encoded = encodeClipboardData(original)
    const decoded = decodeClipboardData(encoded)
    expect(decoded).toBe(original)
  })

  it('should handle complex node data with multiple Unicode fields', () => {
    const original = JSON.stringify({
      nodes: [
        {
          id: 1,
          type: 'LoadImage',
          localized_name: '图像',
          inputs: [{ localized_name: '图片', name: 'image' }],
          outputs: [{ localized_name: '输出', name: 'output' }]
        }
      ],
      groups: [{ title: '预处理组 🔧' }],
      links: []
    })
    const encoded = encodeClipboardData(original)
    const decoded = decodeClipboardData(encoded)
    expect(decoded).toBe(original)
    expect(JSON.parse(decoded)).toEqual(JSON.parse(original))
  })

  it('should produce valid base64 output', () => {
    const original = '{"localized_name":"中文测试"}'
    const encoded = encodeClipboardData(original)
    // Base64 should only contain valid characters
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/)
  })

  it('should fail with plain btoa for non-Latin1 characters', () => {
    const original = '{"localized_name":"图像"}'
    // This demonstrates why we need TextEncoder - plain btoa fails
    expect(() => btoa(original)).toThrow()
  })

  it('should round-trip node data with layout and presentation fields', () => {
    const nodeData = {
      nodes: [
        {
          id: 1,
          type: 'LoadImage',
          pos: [100, 200],
          size: [300, 150],
          title: 'My Image Loader',
          mode: 0,
          flags: { collapsed: false },
          color: '#ff0000'
        }
      ],
      links: []
    }
    const original = JSON.stringify(nodeData)
    const encoded = encodeClipboardData(original)
    const decoded = decodeClipboardData(encoded)
    const parsed = JSON.parse(decoded)

    expect(parsed.nodes[0].pos).toEqual([100, 200])
    expect(parsed.nodes[0].size).toEqual([300, 150])
    expect(parsed.nodes[0].title).toBe('My Image Loader')
    expect(parsed.nodes[0].color).toBe('#ff0000')
    expect(parsed.nodes[0].flags).toEqual({ collapsed: false })
  })
})
