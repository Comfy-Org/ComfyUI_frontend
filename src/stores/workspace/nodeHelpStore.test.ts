import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useNodeHelpStore } from '@/stores/workspace/nodeHelpStore'

vi.mock('@/scripts/api', () => ({
  api: {
    fileURL: vi.fn((url) => url)
  }
}))

vi.mock('@/i18n', () => ({
  i18n: {
    global: {
      locale: {
        value: 'en'
      }
    }
  }
}))

vi.mock('@/types/nodeSource', () => ({
  NodeSourceType: {
    Core: 'core',
    CustomNodes: 'custom_nodes'
  },
  getNodeSource: vi.fn((pythonModule) => {
    if (pythonModule?.startsWith('custom_nodes.')) {
      return { type: 'custom_nodes' }
    }
    return { type: 'core' }
  })
}))

vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html) => html)
  }
}))

vi.mock('marked', () => ({
  marked: {
    parse: vi.fn((markdown, options) => {
      if (options?.renderer) {
        if (markdown.includes('![')) {
          const matches = markdown.match(/!\[(.*?)\]\((.*?)\)/)
          if (matches) {
            const [, text, href] = matches
            return options.renderer.image({ href, text, title: '' })
          }
        }
      }
      return `<p>${markdown}</p>`
    })
  },
  Renderer: class Renderer {
    image = vi.fn(
      ({ href, title, text }) =>
        `<img src="${href}" alt="${text}"${title ? ` title="${title}"` : ''} />`
    )
    link = vi.fn(
      ({ href, title, text }) =>
        `<a href="${href}"${title ? ` title="${title}"` : ''}>${text}</a>`
    )
  }
}))

describe('nodeHelpStore', () => {
  // Define a mock node for testing
  const mockCoreNode = {
    name: 'TestNode',
    display_name: 'Test Node',
    description: 'A test node',
    inputs: {},
    outputs: [],
    python_module: 'comfy.test_node'
  }

  const mockCustomNode = {
    name: 'CustomNode',
    display_name: 'Custom Node',
    description: 'A custom node',
    inputs: {},
    outputs: [],
    python_module: 'custom_nodes.test_module.custom@1.0.0'
  }

  // Mock fetch responses
  const mockFetch = vi.fn()
  global.fetch = mockFetch

  beforeEach(() => {
    // Setup Pinia
    setActivePinia(createPinia())
    mockFetch.mockReset()
  })

  it('should initialize with empty state', () => {
    const nodeHelpStore = useNodeHelpStore()
    expect(nodeHelpStore.currentHelpNode).toBeNull()
    expect(nodeHelpStore.isHelpOpen).toBe(false)
  })

  it('should open help for a node', () => {
    const nodeHelpStore = useNodeHelpStore()

    nodeHelpStore.openHelp(mockCoreNode as any)

    expect(nodeHelpStore.currentHelpNode).toStrictEqual(mockCoreNode)
    expect(nodeHelpStore.isHelpOpen).toBe(true)
  })

  it('should close help', () => {
    const nodeHelpStore = useNodeHelpStore()

    nodeHelpStore.openHelp(mockCoreNode as any)
    expect(nodeHelpStore.isHelpOpen).toBe(true)

    nodeHelpStore.closeHelp()
    expect(nodeHelpStore.currentHelpNode).toBeNull()
    expect(nodeHelpStore.isHelpOpen).toBe(false)
  })

  it('should generate correct baseUrl for core nodes', async () => {
    const nodeHelpStore = useNodeHelpStore()

    nodeHelpStore.openHelp(mockCoreNode as any)
    await nextTick()

    expect(nodeHelpStore.baseUrl).toBe(`/docs/${mockCoreNode.name}/`)
  })

  it('should generate correct baseUrl for custom nodes', async () => {
    const nodeHelpStore = useNodeHelpStore()

    nodeHelpStore.openHelp(mockCustomNode as any)
    await nextTick()

    expect(nodeHelpStore.baseUrl).toBe('/extensions/test_module/docs/')
  })

  it('should render markdown content correctly', async () => {
    const nodeHelpStore = useNodeHelpStore()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '# Test Help\nThis is test help content'
    })

    nodeHelpStore.openHelp(mockCoreNode as any)
    await flushPromises()

    expect(nodeHelpStore.renderedHelpHtml).toContain(
      'This is test help content'
    )
  })

  it('should handle fetch errors and fall back to description', async () => {
    const nodeHelpStore = useNodeHelpStore()

    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found'
    })

    nodeHelpStore.openHelp(mockCoreNode as any)
    await flushPromises()

    expect(nodeHelpStore.error).toBe('Not Found')
    expect(nodeHelpStore.renderedHelpHtml).toContain(mockCoreNode.description)
  })

  it('should include alt attribute for images', async () => {
    const nodeHelpStore = useNodeHelpStore()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '![image](test.jpg)'
    })

    nodeHelpStore.openHelp(mockCustomNode as any)
    await flushPromises()
    expect(nodeHelpStore.renderedHelpHtml).toContain('alt="image"')
  })

  it('should prefix relative video src in custom nodes', async () => {
    const nodeHelpStore = useNodeHelpStore()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<video src="video.mp4"></video>'
    })

    nodeHelpStore.openHelp(mockCustomNode as any)
    await flushPromises()
    expect(nodeHelpStore.renderedHelpHtml).toContain(
      'src="/extensions/test_module/docs/video.mp4"'
    )
  })

  it('should prefix relative video src for core nodes with node-specific base URL', async () => {
    const nodeHelpStore = useNodeHelpStore()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<video src="video.mp4"></video>'
    })

    nodeHelpStore.openHelp(mockCoreNode as any)
    await flushPromises()
    expect(nodeHelpStore.renderedHelpHtml).toContain(
      `src="/docs/${mockCoreNode.name}/video.mp4"`
    )
  })

  it('should prefix relative source src in custom nodes', async () => {
    const nodeHelpStore = useNodeHelpStore()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        '<video><source src="video.mp4" type="video/mp4" /></video>'
    })

    nodeHelpStore.openHelp(mockCustomNode as any)
    await flushPromises()
    expect(nodeHelpStore.renderedHelpHtml).toContain(
      'src="/extensions/test_module/docs/video.mp4"'
    )
  })

  it('should prefix relative source src for core nodes with node-specific base URL', async () => {
    const nodeHelpStore = useNodeHelpStore()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        '<video><source src="video.webm" type="video/webm" /></video>'
    })

    nodeHelpStore.openHelp(mockCoreNode as any)
    await flushPromises()
    expect(nodeHelpStore.renderedHelpHtml).toContain(
      `src="/docs/${mockCoreNode.name}/video.webm"`
    )
  })

  it('should handle loading state', async () => {
    const nodeHelpStore = useNodeHelpStore()

    mockFetch.mockImplementationOnce(() => new Promise(() => {})) // Never resolves

    nodeHelpStore.openHelp(mockCoreNode as any)
    await nextTick()

    expect(nodeHelpStore.isLoading).toBe(true)
  })

  it('should try fallback URL for custom nodes', async () => {
    const nodeHelpStore = useNodeHelpStore()

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '# Fallback content'
      })

    nodeHelpStore.openHelp(mockCustomNode as any)
    await flushPromises()

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch).toHaveBeenCalledWith(
      '/extensions/test_module/docs/CustomNode/en.md'
    )
    expect(mockFetch).toHaveBeenCalledWith(
      '/extensions/test_module/docs/CustomNode.md'
    )
  })

  it('should prefix relative img src in raw HTML for custom nodes', async () => {
    const nodeHelpStore = useNodeHelpStore()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '# Test\n<img src="image.png" alt="Test image">'
    })

    nodeHelpStore.openHelp(mockCustomNode as any)
    await flushPromises()
    expect(nodeHelpStore.renderedHelpHtml).toContain(
      'src="/extensions/test_module/docs/image.png"'
    )
    expect(nodeHelpStore.renderedHelpHtml).toContain('alt="Test image"')
  })

  it('should prefix relative img src in raw HTML for core nodes', async () => {
    const nodeHelpStore = useNodeHelpStore()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '# Test\n<img src="image.png" alt="Test image">'
    })

    nodeHelpStore.openHelp(mockCoreNode as any)
    await flushPromises()
    expect(nodeHelpStore.renderedHelpHtml).toContain(
      `src="/docs/${mockCoreNode.name}/image.png"`
    )
    expect(nodeHelpStore.renderedHelpHtml).toContain('alt="Test image"')
  })

  it('should not prefix absolute img src in raw HTML', async () => {
    const nodeHelpStore = useNodeHelpStore()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<img src="/absolute/image.png" alt="Absolute">'
    })

    nodeHelpStore.openHelp(mockCustomNode as any)
    await flushPromises()
    expect(nodeHelpStore.renderedHelpHtml).toContain(
      'src="/absolute/image.png"'
    )
    expect(nodeHelpStore.renderedHelpHtml).toContain('alt="Absolute"')
  })

  it('should not prefix external img src in raw HTML', async () => {
    const nodeHelpStore = useNodeHelpStore()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        '<img src="https://example.com/image.png" alt="External">'
    })

    nodeHelpStore.openHelp(mockCustomNode as any)
    await flushPromises()
    expect(nodeHelpStore.renderedHelpHtml).toContain(
      'src="https://example.com/image.png"'
    )
    expect(nodeHelpStore.renderedHelpHtml).toContain('alt="External"')
  })

  it('should handle various quote styles in media src attributes', async () => {
    const nodeHelpStore = useNodeHelpStore()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => `# Media Test

Testing quote styles in properly formed HTML:

<video src="video1.mp4" controls></video>
<video src='video2.mp4' controls></video>
<img src="image1.png" alt="Double quotes">
<img src='image2.png' alt='Single quotes'>

<video controls>
  <source src="video3.mp4" type="video/mp4">
  <source src='video3.webm' type='video/webm'>
</video>

The MEDIA_SRC_REGEX handles both single and double quotes in img, video and source tags.`
    })

    nodeHelpStore.openHelp(mockCoreNode as any)
    await flushPromises()

    // Check that all media elements with different quote styles are prefixed correctly
    // Double quotes remain as double quotes
    expect(nodeHelpStore.renderedHelpHtml).toContain(
      `src="/docs/${mockCoreNode.name}/video1.mp4"`
    )
    expect(nodeHelpStore.renderedHelpHtml).toContain(
      `src="/docs/${mockCoreNode.name}/image1.png"`
    )
    expect(nodeHelpStore.renderedHelpHtml).toContain(
      `src="/docs/${mockCoreNode.name}/video3.mp4"`
    )

    // Single quotes remain as single quotes in the output
    expect(nodeHelpStore.renderedHelpHtml).toContain(
      `src='/docs/${mockCoreNode.name}/video2.mp4'`
    )
    expect(nodeHelpStore.renderedHelpHtml).toContain(
      `src='/docs/${mockCoreNode.name}/image2.png'`
    )
    expect(nodeHelpStore.renderedHelpHtml).toContain(
      `src='/docs/${mockCoreNode.name}/video3.webm'`
    )
  })
})
