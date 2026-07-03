import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useNodeHelpContent } from '@/composables/useNodeHelpContent'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

async function flushPromises() {
  await new Promise((r) => setTimeout(r, 0))
}

function createMockNode(
  overrides: Partial<ComfyNodeDefImpl>
): ComfyNodeDefImpl {
  return {
    name: 'TestNode',
    display_name: 'Test Node',
    description: 'A test node',
    category: 'test',
    python_module: 'comfy.test_node',
    inputs: {},
    outputs: [],
    deprecated: false,
    experimental: false,
    output_node: false,
    api_node: false,
    ...overrides
  } as ComfyNodeDefImpl
}

vi.mock('@/scripts/api', () => ({
  api: {
    fileURL: vi.fn((url) => url)
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

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} } })

function withI18n<T>(fn: () => T): T {
  let result!: T
  const app = createApp(
    defineComponent({
      setup() {
        result = fn()
        return () => null
      }
    })
  )
  app.use(i18n)
  app.mount(document.createElement('div'))
  return result
}

describe('useNodeHelpContent', () => {
  const mockCoreNode = createMockNode({
    name: 'TestNode',
    display_name: 'Test Node',
    description: 'A test node',
    python_module: 'comfy.test_node'
  })

  const mockCustomNode = createMockNode({
    name: 'CustomNode',
    display_name: 'Custom Node',
    description: 'A custom node',
    python_module: 'custom_nodes.test_module.custom@1.0.0'
  })

  const mockFetch = vi.fn()

  beforeEach(() => {
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should generate correct baseUrl for core nodes', async () => {
    const nodeRef = ref(mockCoreNode)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '# Test'
    })

    const { baseUrl } = withI18n(() => useNodeHelpContent(nodeRef))
    await nextTick()

    expect(baseUrl.value).toBe(`/docs/${mockCoreNode.name}/`)
  })

  it('should generate correct baseUrl for custom nodes', async () => {
    const nodeRef = ref(mockCustomNode)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '# Test'
    })

    const { baseUrl } = withI18n(() => useNodeHelpContent(nodeRef))
    await nextTick()

    expect(baseUrl.value).toBe('/extensions/test_module/docs/')
  })

  it('should render markdown content correctly', async () => {
    const nodeRef = ref(mockCoreNode)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '# Test Help\nThis is test help content'
    })

    const { renderedHelpHtml } = withI18n(() => useNodeHelpContent(nodeRef))
    await flushPromises()

    expect(renderedHelpHtml.value).toContain('This is test help content')
  })

  it('should handle fetch errors and fall back to description', async () => {
    const nodeRef = ref(mockCoreNode)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found'
    })

    const { error, renderedHelpHtml } = withI18n(() =>
      useNodeHelpContent(nodeRef)
    )
    await flushPromises()

    expect(error.value).toBe('Not Found')
    expect(renderedHelpHtml.value).toContain(mockCoreNode.description)
  })

  it('should include alt attribute for images', async () => {
    const nodeRef = ref(mockCustomNode)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '![image](test.jpg)'
    })

    const { renderedHelpHtml } = withI18n(() => useNodeHelpContent(nodeRef))
    await flushPromises()

    expect(renderedHelpHtml.value).toContain('alt="image"')
  })

  it('should prefix relative video src in custom nodes', async () => {
    const nodeRef = ref(mockCustomNode)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<video src="video.mp4"></video>'
    })

    const { renderedHelpHtml } = withI18n(() => useNodeHelpContent(nodeRef))
    await flushPromises()

    expect(renderedHelpHtml.value).toContain(
      'src="/extensions/test_module/docs/video.mp4"'
    )
  })

  it('should prefix relative video src for core nodes with node-specific base URL', async () => {
    const nodeRef = ref(mockCoreNode)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<video src="video.mp4"></video>'
    })

    const { renderedHelpHtml } = withI18n(() => useNodeHelpContent(nodeRef))
    await flushPromises()

    expect(renderedHelpHtml.value).toContain(
      `src="/docs/${mockCoreNode.name}/video.mp4"`
    )
  })

  it('should handle loading state', async () => {
    const nodeRef = ref(mockCoreNode)
    mockFetch.mockImplementationOnce(() => new Promise(() => {})) // Never resolves

    const { isLoading } = withI18n(() => useNodeHelpContent(nodeRef))
    await nextTick()

    expect(isLoading.value).toBe(true)
  })

  it('should try fallback URL for custom nodes', async () => {
    const nodeRef = ref(mockCustomNode)
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found'
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '# Fallback content'
      })

    withI18n(() => useNodeHelpContent(nodeRef))
    await flushPromises()

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch).toHaveBeenCalledWith(
      '/extensions/test_module/docs/CustomNode/en.md'
    )
    expect(mockFetch).toHaveBeenCalledWith(
      '/extensions/test_module/docs/CustomNode.md'
    )
  })

  it('should prefix relative source src in custom nodes', async () => {
    const nodeRef = ref(mockCustomNode)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        '<video><source src="video.mp4" type="video/mp4" /></video>'
    })

    const { renderedHelpHtml } = withI18n(() => useNodeHelpContent(nodeRef))
    await flushPromises()

    expect(renderedHelpHtml.value).toContain(
      'src="/extensions/test_module/docs/video.mp4"'
    )
  })

  it('should prefix relative source src for core nodes with node-specific base URL', async () => {
    const nodeRef = ref(mockCoreNode)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        '<video><source src="video.webm" type="video/webm" /></video>'
    })

    const { renderedHelpHtml } = withI18n(() => useNodeHelpContent(nodeRef))
    await flushPromises()

    expect(renderedHelpHtml.value).toContain(
      `src="/docs/${mockCoreNode.name}/video.webm"`
    )
  })

  it('should prefix relative img src in raw HTML for custom nodes', async () => {
    const nodeRef = ref(mockCustomNode)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '# Test\n<img src="image.png" alt="Test image">'
    })

    const { renderedHelpHtml } = withI18n(() => useNodeHelpContent(nodeRef))
    await flushPromises()

    expect(renderedHelpHtml.value).toContain(
      'src="/extensions/test_module/docs/image.png"'
    )
    expect(renderedHelpHtml.value).toContain('alt="Test image"')
  })

  it('should prefix relative img src in raw HTML for core nodes', async () => {
    const nodeRef = ref(mockCoreNode)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '# Test\n<img src="image.png" alt="Test image">'
    })

    const { renderedHelpHtml } = withI18n(() => useNodeHelpContent(nodeRef))
    await flushPromises()

    expect(renderedHelpHtml.value).toContain(
      `src="/docs/${mockCoreNode.name}/image.png"`
    )
    expect(renderedHelpHtml.value).toContain('alt="Test image"')
  })

  it('should not prefix absolute img src in raw HTML', async () => {
    const nodeRef = ref(mockCustomNode)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => '<img src="/absolute/image.png" alt="Absolute">'
    })

    const { renderedHelpHtml } = withI18n(() => useNodeHelpContent(nodeRef))
    await flushPromises()

    expect(renderedHelpHtml.value).toContain('src="/absolute/image.png"')
    expect(renderedHelpHtml.value).toContain('alt="Absolute"')
  })

  it('should not prefix external img src in raw HTML', async () => {
    const nodeRef = ref(mockCustomNode)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        '<img src="https://example.com/image.png" alt="External">'
    })

    const { renderedHelpHtml } = withI18n(() => useNodeHelpContent(nodeRef))
    await flushPromises()

    expect(renderedHelpHtml.value).toContain(
      'src="https://example.com/image.png"'
    )
    expect(renderedHelpHtml.value).toContain('alt="External"')
  })

  it('should handle various quote styles in media src attributes', async () => {
    const nodeRef = ref(mockCoreNode)
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

    const { renderedHelpHtml } = withI18n(() => useNodeHelpContent(nodeRef))
    await flushPromises()

    // All media src attributes should be prefixed correctly
    // Note: marked normalizes quotes to double quotes in output
    expect(renderedHelpHtml.value).toContain(
      `src="/docs/${mockCoreNode.name}/video1.mp4"`
    )
    expect(renderedHelpHtml.value).toContain(
      `src="/docs/${mockCoreNode.name}/video2.mp4"`
    )
    expect(renderedHelpHtml.value).toContain(
      `src="/docs/${mockCoreNode.name}/image1.png"`
    )
    expect(renderedHelpHtml.value).toContain(
      `src="/docs/${mockCoreNode.name}/image2.png"`
    )
    expect(renderedHelpHtml.value).toContain(
      `src="/docs/${mockCoreNode.name}/video3.mp4"`
    )
    expect(renderedHelpHtml.value).toContain(
      `src="/docs/${mockCoreNode.name}/video3.webm"`
    )
  })

  it('should ignore stale requests when node changes', async () => {
    const nodeRef = ref(mockCoreNode)
    let resolveFirst: (value: unknown) => void
    const firstRequest = new Promise((resolve) => {
      resolveFirst = resolve
    })

    mockFetch
      .mockImplementationOnce(() => firstRequest)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '# Second node content'
      })

    const { helpContent } = withI18n(() => useNodeHelpContent(nodeRef))
    await nextTick()

    // Change node before first request completes
    nodeRef.value = mockCustomNode
    await nextTick()
    await flushPromises()

    // Now resolve the first (stale) request
    resolveFirst!({
      ok: true,
      text: async () => '# First node content'
    })
    await flushPromises()

    // Should have second node's content, not first
    expect(helpContent.value).toBe('# Second node content')
  })

  it('returns empty state when no node is selected', async () => {
    const nodeRef = ref<ComfyNodeDefImpl | null>(null)

    const { baseUrl, helpContent, isLoading, error } = withI18n(() =>
      useNodeHelpContent(nodeRef)
    )
    await nextTick()

    expect(baseUrl.value).toBe('')
    expect(helpContent.value).toBe('')
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('uses stringified non-error rejections with the node description', async () => {
    const nodeRef = ref(mockCoreNode)
    mockFetch.mockRejectedValueOnce('offline')

    const { error, helpContent } = withI18n(() => useNodeHelpContent(nodeRef))
    await flushPromises()

    expect(error.value).toBe('offline')
    expect(helpContent.value).toBe(mockCoreNode.description)
  })

  it('ignores stale rejected requests after the node changes', async () => {
    const nodeRef = ref(mockCoreNode)
    let rejectFirst: (reason?: unknown) => void
    const firstRequest = new Promise((_resolve, reject) => {
      rejectFirst = reject
    })

    mockFetch
      .mockImplementationOnce(() => firstRequest)
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '# Current node content'
      })

    const { error, helpContent } = withI18n(() => useNodeHelpContent(nodeRef))
    await nextTick()

    nodeRef.value = mockCustomNode
    await nextTick()
    await flushPromises()

    rejectFirst!(new Error('stale failure'))
    await flushPromises()

    expect(error.value).toBeNull()
    expect(helpContent.value).toBe('# Current node content')
  })
})
