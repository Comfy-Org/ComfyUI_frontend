import { respondToFetch } from '@comfyorg/test-utils/fetch'
import { render } from '@testing-library/vue'
import { assert, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useNodeHelpContent as useNodeHelpContentComposable } from '@/composables/useNodeHelpContent'
import { reportError } from '@/platform/telemetry/reportError'
import { getNodeSource } from '@/types/nodeSource'
import type { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { nodeHelpPage: { notFound: 'Help not found' } }
  }
})

function useNodeHelpContent(
  nodeRef: Parameters<typeof useNodeHelpContentComposable>[0]
) {
  let result: ReturnType<typeof useNodeHelpContentComposable> | undefined
  const Wrapper = defineComponent({
    setup() {
      result = useNodeHelpContentComposable(nodeRef)
      return () => null
    }
  })
  render(Wrapper, { global: { plugins: [i18n] } })
  assert(result)
  return result
}

async function flushPromises() {
  await new Promise((r) => setTimeout(r, 0))
}

function markdownResponse(markdown: string): Response {
  return new Response(markdown)
}

function createMockNode(
  overrides: Partial<ComfyNodeDefImpl>
): ComfyNodeDefImpl {
  const node = {
    name: 'TestNode',
    display_name: 'Test Node',
    description: 'A test node',
    category: 'test',
    python_module: 'nodes',
    inputs: {},
    outputs: [],
    deprecated: false,
    experimental: false,
    output_node: false,
    api_node: false,
    ...overrides
  }
  return {
    ...node,
    nodeSource:
      overrides.nodeSource ??
      getNodeSource(node.python_module, node.essentials_category)
  } as ComfyNodeDefImpl
}

vi.mock(import('@/scripts/api'))

vi.mock(import('@/platform/telemetry/reportError'))

describe('useNodeHelpContent', () => {
  const mockCoreNode = createMockNode({
    name: 'TestNode',
    display_name: 'Test Node',
    description: 'A test node',
    python_module: 'nodes'
  })

  const mockCustomNode = createMockNode({
    name: 'CustomNode',
    display_name: 'Custom Node',
    description: 'A custom node',
    python_module: 'custom_nodes.test_module.custom@1.0.0'
  })

  it('should generate correct baseUrl for core nodes', async () => {
    const nodeRef = ref(mockCoreNode)
    vi.mocked(fetch).mockResolvedValueOnce(markdownResponse('# Test'))

    const { baseUrl } = useNodeHelpContent(nodeRef)
    await nextTick()

    expect(baseUrl.value).toBe(`/docs/${mockCoreNode.name}/`)
  })

  it('should generate correct baseUrl for custom nodes', async () => {
    const nodeRef = ref(mockCustomNode)
    vi.mocked(fetch).mockResolvedValueOnce(markdownResponse('# Test'))

    const { baseUrl } = useNodeHelpContent(nodeRef)
    await nextTick()

    expect(baseUrl.value).toBe('/extensions/test_module/docs/')
  })

  it('should render markdown content correctly', async () => {
    const nodeRef = ref(mockCoreNode)
    vi.mocked(fetch).mockResolvedValueOnce(
      markdownResponse('# Test Help\nThis is test help content')
    )

    const { renderedHelpHtml } = useNodeHelpContent(nodeRef)
    await flushPromises()

    expect(renderedHelpHtml.value).toContain('This is test help content')
  })

  it('should show the unavailable state when core help is absent', async () => {
    const nodeRef = ref(mockCoreNode)
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 404, statusText: 'Not Found' })
    )

    const { error, renderedHelpHtml } = useNodeHelpContent(nodeRef)
    await flushPromises()

    expect(error.value).toBe('Help not found')
    expect(renderedHelpHtml.value).toContain(mockCoreNode.description)
  })

  it('should show the unavailable state when custom help is absent', async () => {
    const nodeRef = ref(mockCustomNode)
    vi.mocked(fetch).mockImplementation(
      async () => new Response(null, { status: 404, statusText: 'Not Found' })
    )

    const { error, renderedHelpHtml } = useNodeHelpContent(nodeRef)
    await flushPromises()

    expect(error.value).toBe('Help not found')
    expect(renderedHelpHtml.value).toContain(mockCustomNode.description)
  })

  it('should use core help for Essentials nodes', async () => {
    const node = createMockNode({
      name: 'EssentialsNode',
      essentials_category: 'image',
      python_module: 'custom_nodes.test_module'
    })
    vi.mocked(fetch).mockResolvedValueOnce(
      markdownResponse('# Essentials help')
    )

    const { renderedHelpHtml } = useNodeHelpContent(ref(node))
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('/docs/EssentialsNode/en.md')
    expect(renderedHelpHtml.value).toContain('Essentials help')
  })

  it('should use the core base URL for relative Essentials images', async () => {
    const node = createMockNode({
      name: 'EssentialsNode',
      essentials_category: 'image',
      python_module: 'custom_nodes.ComfyUI-Essentials'
    })
    vi.mocked(fetch).mockResolvedValueOnce(
      markdownResponse('![preview](preview.png)')
    )

    const { renderedHelpHtml } = useNodeHelpContent(ref(node))
    await flushPromises()

    expect(renderedHelpHtml.value).toContain(
      'src="/docs/EssentialsNode/preview.png"'
    )
  })

  it('uses a blueprint description even when it has an Essentials category', async () => {
    const node = createMockNode({
      description: 'Blueprint help',
      essentials_category: 'image',
      python_module: 'blueprint'
    })

    const { error, renderedHelpHtml } = useNodeHelpContent(ref(node))
    await flushPromises()

    expect(error.value).toBeNull()
    expect(renderedHelpHtml.value).toContain('Blueprint help')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('should show the unavailable state for a blueprint without a description', async () => {
    const nodeRef = ref(
      createMockNode({ description: '', python_module: 'blueprint' })
    )

    const { error, renderedHelpHtml } = useNodeHelpContent(nodeRef)
    await flushPromises()

    expect(error.value).toBe('Help not found')
    expect(renderedHelpHtml.value).toBe('')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('should use core help routing for an unrecognized module', async () => {
    const nodeRef = ref(
      createMockNode({
        name: 'UnknownNode',
        description: 'Unknown node',
        python_module: 'custom_nodes.'
      })
    )
    vi.mocked(fetch).mockResolvedValueOnce(markdownResponse('# Unknown help'))

    const { error, renderedHelpHtml } = useNodeHelpContent(nodeRef)
    await flushPromises()

    expect(error.value).toBeNull()
    expect(renderedHelpHtml.value).toContain('Unknown help')
    expect(fetch).toHaveBeenCalledWith('/docs/UnknownNode/en.md')
  })

  it('should show the unavailable state for HTML fallback responses', async () => {
    const nodeRef = ref(mockCoreNode)
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('<html>SPA fallback</html>', {
        statusText: 'OK',
        headers: { 'content-type': 'text/html' }
      })
    )

    const { error, renderedHelpHtml } = useNodeHelpContent(nodeRef)
    await flushPromises()

    expect(error.value).toBe('Help not found')
    expect(renderedHelpHtml.value).toContain(mockCoreNode.description)
  })

  it('should log and recover from infrastructure failures', async () => {
    const nodeRef = ref(mockCoreNode)
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, {
        status: 500,
        statusText: 'Internal Server Error'
      })
    )

    const { error, renderedHelpHtml } = useNodeHelpContent(nodeRef)
    await flushPromises()

    expect(reportError).toHaveBeenCalledWith(
      new Error(
        'Failed to fetch node help (500 Internal Server Error) at /docs/TestNode/en.md'
      ),
      {
        errorType: 'node_help_fetch_failure',
        surface: 'graph',
        context: { path: '/docs/TestNode/en.md' }
      }
    )
    expect(error.value).toBe(
      'Failed to fetch node help (500 Internal Server Error) at /docs/TestNode/en.md'
    )
    expect(renderedHelpHtml.value).toContain(mockCoreNode.description)
  })

  it('should include alt attribute for images', async () => {
    const nodeRef = ref(mockCustomNode)
    vi.mocked(fetch).mockResolvedValueOnce(
      markdownResponse('![image](test.jpg)')
    )

    const { renderedHelpHtml } = useNodeHelpContent(nodeRef)
    await flushPromises()

    expect(renderedHelpHtml.value).toContain('alt="image"')
  })

  it('should prefix relative video src in custom nodes', async () => {
    const nodeRef = ref(mockCustomNode)
    vi.mocked(fetch).mockResolvedValueOnce(
      markdownResponse('<video src="video.mp4"></video>')
    )

    const { renderedHelpHtml } = useNodeHelpContent(nodeRef)
    await flushPromises()

    expect(renderedHelpHtml.value).toContain(
      'src="/extensions/test_module/docs/video.mp4"'
    )
  })

  it('should prefix relative video src for core nodes with node-specific base URL', async () => {
    const nodeRef = ref(mockCoreNode)
    vi.mocked(fetch).mockResolvedValueOnce(
      markdownResponse('<video src="video.mp4"></video>')
    )

    const { renderedHelpHtml } = useNodeHelpContent(nodeRef)
    await flushPromises()

    expect(renderedHelpHtml.value).toContain(
      `src="/docs/${mockCoreNode.name}/video.mp4"`
    )
  })

  it('should handle loading state', async () => {
    const nodeRef = ref(mockCoreNode)
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {})) // Never resolves

    const { isLoading } = useNodeHelpContent(nodeRef)
    await nextTick()

    expect(isLoading.value).toBe(true)
  })

  it('should try fallback URL for custom nodes', async () => {
    const nodeRef = ref(mockCustomNode)
    respondToFetch(
      '/extensions/test_module/docs/CustomNode/en.md',
      () => new Response(null, { status: 404, statusText: 'Not Found' })
    )
    respondToFetch('/extensions/test_module/docs/CustomNode.md', () =>
      markdownResponse('# Fallback content')
    )

    const { renderedHelpHtml } = useNodeHelpContent(nodeRef)
    await flushPromises()

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenCalledWith(
      '/extensions/test_module/docs/CustomNode/en.md'
    )
    expect(fetch).toHaveBeenCalledWith(
      '/extensions/test_module/docs/CustomNode.md'
    )
    expect(renderedHelpHtml.value).toContain('Fallback content')
  })

  it('should use custom node fallback help after a localized request fails', async () => {
    const nodeRef = ref(mockCustomNode)
    const requestError = new Error('network failure')
    vi.mocked(fetch)
      .mockRejectedValueOnce(requestError)
      .mockResolvedValueOnce(markdownResponse('# Fallback content'))

    const { error, renderedHelpHtml } = useNodeHelpContent(nodeRef)
    await flushPromises()

    expect(error.value).toBeNull()
    expect(renderedHelpHtml.value).toContain('Fallback content')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(reportError).toHaveBeenCalledWith(requestError, {
      errorType: 'node_help_fetch_failure',
      surface: 'graph',
      context: {
        path: '/extensions/test_module/docs/CustomNode/en.md'
      }
    })
  })

  it('should prefix relative source src in custom nodes', async () => {
    const nodeRef = ref(mockCustomNode)
    vi.mocked(fetch).mockResolvedValueOnce(
      markdownResponse(
        '<video><source src="video.mp4" type="video/mp4" /></video>'
      )
    )

    const { renderedHelpHtml } = useNodeHelpContent(nodeRef)
    await flushPromises()

    expect(renderedHelpHtml.value).toContain(
      'src="/extensions/test_module/docs/video.mp4"'
    )
  })

  it('should prefix relative source src for core nodes with node-specific base URL', async () => {
    const nodeRef = ref(mockCoreNode)
    vi.mocked(fetch).mockResolvedValueOnce(
      markdownResponse(
        '<video><source src="video.webm" type="video/webm" /></video>'
      )
    )

    const { renderedHelpHtml } = useNodeHelpContent(nodeRef)
    await flushPromises()

    expect(renderedHelpHtml.value).toContain(
      `src="/docs/${mockCoreNode.name}/video.webm"`
    )
  })

  it('should prefix relative img src in raw HTML for custom nodes', async () => {
    const nodeRef = ref(mockCustomNode)
    vi.mocked(fetch).mockResolvedValueOnce(
      markdownResponse('# Test\n<img src="image.png" alt="Test image">')
    )

    const { renderedHelpHtml } = useNodeHelpContent(nodeRef)
    await flushPromises()

    expect(renderedHelpHtml.value).toContain(
      'src="/extensions/test_module/docs/image.png"'
    )
    expect(renderedHelpHtml.value).toContain('alt="Test image"')
  })

  it('should prefix relative img src in raw HTML for core nodes', async () => {
    const nodeRef = ref(mockCoreNode)
    vi.mocked(fetch).mockResolvedValueOnce(
      markdownResponse('# Test\n<img src="image.png" alt="Test image">')
    )

    const { renderedHelpHtml } = useNodeHelpContent(nodeRef)
    await flushPromises()

    expect(renderedHelpHtml.value).toContain(
      `src="/docs/${mockCoreNode.name}/image.png"`
    )
    expect(renderedHelpHtml.value).toContain('alt="Test image"')
  })

  it('should not prefix absolute img src in raw HTML', async () => {
    const nodeRef = ref(mockCustomNode)
    vi.mocked(fetch).mockResolvedValueOnce(
      markdownResponse('<img src="/absolute/image.png" alt="Absolute">')
    )

    const { renderedHelpHtml } = useNodeHelpContent(nodeRef)
    await flushPromises()

    expect(renderedHelpHtml.value).toContain('src="/absolute/image.png"')
    expect(renderedHelpHtml.value).toContain('alt="Absolute"')
  })

  it('should not prefix external img src in raw HTML', async () => {
    const nodeRef = ref(mockCustomNode)
    vi.mocked(fetch).mockResolvedValueOnce(
      markdownResponse(
        '<img src="https://example.com/image.png" alt="External">'
      )
    )

    const { renderedHelpHtml } = useNodeHelpContent(nodeRef)
    await flushPromises()

    expect(renderedHelpHtml.value).toContain(
      'src="https://example.com/image.png"'
    )
    expect(renderedHelpHtml.value).toContain('alt="External"')
  })

  it('should handle various quote styles in media src attributes', async () => {
    const nodeRef = ref(mockCoreNode)
    vi.mocked(fetch).mockResolvedValueOnce(
      markdownResponse(`# Media Test

Testing quote styles in properly formed HTML:

<video src="video1.mp4" controls></video>
<video src='video2.mp4' controls></video>
<img src="image1.png" alt="Double quotes">
<img src='image2.png' alt='Single quotes'>

<video controls>
  <source src="video3.mp4" type="video/mp4">
  <source src='video3.webm' type='video/webm'>
</video>

The MEDIA_SRC_REGEX handles both single and double quotes in img, video and source tags.`)
    )

    const { renderedHelpHtml } = useNodeHelpContent(nodeRef)
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
    let resolveFirst: (value: Response) => void
    const firstRequest = new Promise<Response>((resolve) => {
      resolveFirst = resolve
    })

    vi.mocked(fetch)
      .mockImplementationOnce(() => firstRequest)
      .mockResolvedValueOnce(markdownResponse('# Second node content'))

    const { helpContent } = useNodeHelpContent(nodeRef)
    await nextTick()

    // Change node before first request completes
    nodeRef.value = mockCustomNode
    await nextTick()
    await flushPromises()

    // Now resolve the first (stale) request
    resolveFirst!(markdownResponse('# First node content'))
    await flushPromises()

    // Should have second node's content, not first
    expect(helpContent.value).toBe('# Second node content')
  })

  it('should ignore a pending request when the node is cleared', async () => {
    const nodeRef = ref<ComfyNodeDefImpl | null>(mockCoreNode)
    let resolveRequest: ((response: Response) => void) | undefined
    const request = new Promise<Response>((resolve) => {
      resolveRequest = resolve
    })
    vi.mocked(fetch).mockReturnValueOnce(request)

    const { helpContent, isLoading } = useNodeHelpContent(nodeRef)
    await nextTick()
    expect(isLoading.value).toBe(true)

    nodeRef.value = null
    await nextTick()
    expect(isLoading.value).toBe(false)

    assert(resolveRequest)
    resolveRequest(markdownResponse('# Stale content'))
    await flushPromises()

    expect(helpContent.value).toBe('')
  })
})
