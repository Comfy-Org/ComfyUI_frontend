import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useNodeHelp } from '@/composables/useNodeHelp'
import { NodeSourceType } from '@/types/nodeSource'

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
        `<img src="${href}" alt="${text}" title="${title || ''}" />`
    )
    link = vi.fn(
      ({ href, title, text }) =>
        `<a href="${href}" title="${title || ''}">${text}</a>`
    )
  }
}))

describe('useNodeHelp', () => {
  // Define a mock node for testing
  const mockCoreNode = {
    id: 'test-node',
    display_name: 'Test Node',
    description: 'A test node',
    help: '# Test Help\nThis is test help content',
    inputs: {},
    outputs: [],
    python_module: 'comfy.test_node',
    nodeSource: {
      type: NodeSourceType.Core
    }
  }

  const mockCustomNode = {
    id: 'custom-node',
    display_name: 'Custom Node',
    description: 'A custom node',
    help: '# Custom Help\n![image](test.jpg)',
    inputs: {},
    outputs: [],
    python_module: 'custom_nodes.test_module.custom@1.0.0',
    nodeSource: {
      type: NodeSourceType.CustomNodes
    }
  }

  // Reset state before each test
  beforeEach(() => {
    const { closeHelp } = useNodeHelp()
    closeHelp()
  })

  it('should initialize with empty state', () => {
    const { currentHelpNode, isHelpOpen } = useNodeHelp()
    expect(currentHelpNode.value).toBeNull()
    expect(isHelpOpen.value).toBe(false)
  })

  it('should open help for a node', () => {
    const { currentHelpNode, isHelpOpen, openHelp } = useNodeHelp()

    openHelp(mockCoreNode as any)

    expect(currentHelpNode.value).toStrictEqual(mockCoreNode)
    expect(isHelpOpen.value).toBe(true)
  })

  it('should close help', () => {
    const { currentHelpNode, isHelpOpen, openHelp, closeHelp } = useNodeHelp()

    openHelp(mockCoreNode as any)
    expect(isHelpOpen.value).toBe(true)

    closeHelp()
    expect(currentHelpNode.value).toBeNull()
    expect(isHelpOpen.value).toBe(false)
  })

  it('should generate correct baseUrl for core nodes', async () => {
    const { openHelp, baseUrl } = useNodeHelp()

    openHelp(mockCoreNode as any)
    await nextTick()

    expect(baseUrl.value).toBe('')
  })

  it('should generate correct baseUrl for custom nodes', async () => {
    const { openHelp, baseUrl } = useNodeHelp()

    openHelp(mockCustomNode as any)
    await nextTick()

    expect(baseUrl.value).toBe('/extensions/test_module/')
  })

  it('should render markdown content correctly', async () => {
    const { openHelp, renderedHelpHtml } = useNodeHelp()

    openHelp(mockCoreNode as any)
    await nextTick()

    expect(renderedHelpHtml.value).toContain('This is test help content')
  })

  it('should handle relative image paths in custom nodes', async () => {
    const { openHelp, renderedHelpHtml } = useNodeHelp()

    openHelp(mockCustomNode as any)
    await nextTick()

    expect(renderedHelpHtml.value).toContain(
      'src="/extensions/test_module/test.jpg"'
    )
  })

  it('should return empty help html when node has no help', async () => {
    const { openHelp, renderedHelpHtml } = useNodeHelp()

    openHelp({ ...mockCoreNode, help: '' } as any)
    await nextTick()

    expect(renderedHelpHtml.value).toBe('')
  })
})
