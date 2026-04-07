import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { createI18n } from 'vue-i18n'

import { render, screen } from '@testing-library/vue'

import type { ComfyNodeDef as ComfyNodeDefV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import * as markdownRendererUtil from '@/utils/markdownRendererUtil'

import NodePreview from './NodePreview.vue'

describe('NodePreview', () => {
  let i18n: ReturnType<typeof createI18n>
  let pinia: ReturnType<typeof createPinia>

  beforeAll(() => {
    // Create a Vue app instance for PrimeVue
    const app = createApp({})
    app.use(PrimeVue)

    // Create i18n instance
    i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          g: {
            preview: 'Preview'
          }
        }
      }
    })

    // Create pinia instance
    pinia = createPinia()
  })

  const mockNodeDef: ComfyNodeDefV2 = {
    name: 'TestNode',
    display_name:
      'Test Node With A Very Long Display Name That Should Overflow',
    category: 'test',
    output_node: false,
    inputs: {
      test_input: {
        name: 'test_input',
        type: 'STRING',
        tooltip: 'Test input'
      }
    },
    outputs: [],
    python_module: 'test_module',
    description: 'Test node description'
  }

  function renderComponent(nodeDef: ComfyNodeDefV2 = mockNodeDef) {
    return render(NodePreview, {
      global: {
        plugins: [PrimeVue, i18n, pinia],
        stubs: {}
      },
      props: {
        nodeDef
      }
    })
  }

  it('renders node preview with correct structure', () => {
    renderComponent()

    expect(screen.getByTestId('node-preview')).toBeInTheDocument()
    expect(screen.getByTestId('node-header')).toBeInTheDocument()
    expect(screen.getByText('Preview')).toBeInTheDocument()
  })

  it('sets title attribute on node header with full display name', () => {
    renderComponent()
    const nodeHeader = screen.getByTestId('node-header')

    expect(nodeHeader).toHaveAttribute('title', mockNodeDef.display_name)
  })

  it('displays truncated long node names with ellipsis', () => {
    const longNameNodeDef: ComfyNodeDefV2 = {
      ...mockNodeDef,
      display_name:
        'This Is An Extremely Long Node Name That Should Definitely Be Truncated With Ellipsis To Prevent Layout Issues'
    }

    renderComponent(longNameNodeDef)
    const nodeHeader = screen.getByTestId('node-header')

    expect(nodeHeader).toHaveAttribute('title', longNameNodeDef.display_name)
    expect(nodeHeader).toHaveClass('text-ellipsis')
    expect(nodeHeader).toHaveTextContent(longNameNodeDef.display_name!)
  })

  it('handles short node names without issues', () => {
    const shortNameNodeDef: ComfyNodeDefV2 = {
      ...mockNodeDef,
      display_name: 'Short'
    }

    renderComponent(shortNameNodeDef)
    const nodeHeader = screen.getByTestId('node-header')

    expect(nodeHeader).toHaveAttribute('title', 'Short')
    expect(nodeHeader).toHaveTextContent('Short')
  })

  it('applies proper spacing to the dot element', () => {
    renderComponent()
    const headdot = screen.getByTestId('head-dot')

    expect(headdot).toHaveClass('pr-3')
  })

  describe('Description Rendering', () => {
    it('renders plain text description as HTML', () => {
      const plainTextNodeDef: ComfyNodeDefV2 = {
        ...mockNodeDef,
        description: 'This is a plain text description'
      }

      renderComponent(plainTextNodeDef)
      const description = screen.getByTestId('node-description')

      expect(description).toBeInTheDocument()
      expect(description.innerHTML).toContain(
        'This is a plain text description'
      )
    })

    it('renders markdown description with formatting', () => {
      const markdownNodeDef: ComfyNodeDefV2 = {
        ...mockNodeDef,
        description: '**Bold text** and *italic text* with `code`'
      }

      renderComponent(markdownNodeDef)
      const description = screen.getByTestId('node-description')

      expect(description).toBeInTheDocument()
      expect(description.innerHTML).toContain('<strong>Bold text</strong>')
      expect(description.innerHTML).toContain('<em>italic text</em>')
      expect(description.innerHTML).toContain('<code>code</code>')
    })

    it('does not render description element when description is empty', () => {
      const noDescriptionNodeDef: ComfyNodeDefV2 = {
        ...mockNodeDef,
        description: ''
      }

      renderComponent(noDescriptionNodeDef)

      expect(screen.queryByTestId('node-description')).not.toBeInTheDocument()
    })

    it('does not render description element when description is undefined', () => {
      const { description, ...nodeDefWithoutDescription } = mockNodeDef
      renderComponent(nodeDefWithoutDescription as ComfyNodeDefV2)

      expect(screen.queryByTestId('node-description')).not.toBeInTheDocument()
    })

    it('calls renderMarkdownToHtml utility function', () => {
      const spy = vi.spyOn(markdownRendererUtil, 'renderMarkdownToHtml')
      const testDescription = 'Test **markdown** description'

      const nodeDefWithDescription: ComfyNodeDefV2 = {
        ...mockNodeDef,
        description: testDescription
      }

      renderComponent(nodeDefWithDescription)

      expect(spy).toHaveBeenCalledWith(testDescription)
      spy.mockRestore()
    })

    it('handles potentially unsafe markdown content safely', () => {
      const unsafeNodeDef: ComfyNodeDefV2 = {
        ...mockNodeDef,
        description:
          'Safe **markdown** content <script>alert("xss")</script> with `code` blocks'
      }

      renderComponent(unsafeNodeDef)
      const description = screen.queryByTestId('node-description')

      if (description) {
        expect(description.innerHTML).not.toContain('<script>')
        expect(description.innerHTML).not.toContain('alert("xss")')
        expect(description.innerHTML).toContain('<strong>markdown</strong>')
        expect(description.innerHTML).toContain('<code>code</code>')
      } else {
        expect(description).not.toBeInTheDocument()
      }
    })

    it('handles markdown with line breaks', () => {
      const multilineNodeDef: ComfyNodeDefV2 = {
        ...mockNodeDef,
        description: 'Line 1\n\nLine 3 after empty line'
      }

      renderComponent(multilineNodeDef)
      const description = screen.getByTestId('node-description')

      expect(description).toBeInTheDocument()
      expect(description.innerHTML).toContain('<p>')
    })

    it('handles markdown lists', () => {
      const listNodeDef: ComfyNodeDefV2 = {
        ...mockNodeDef,
        description: '- Item 1\n- Item 2\n- Item 3'
      }

      renderComponent(listNodeDef)
      const description = screen.getByTestId('node-description')

      expect(description).toBeInTheDocument()
      expect(description.innerHTML).toContain('<ul>')
      expect(description.innerHTML).toContain('<li>')
    })

    it('applies correct styling classes to description', () => {
      renderComponent()
      const description = screen.getByTestId('node-description')

      expect(description).toHaveClass('_sb_description')
    })

    it('uses v-html directive for rendered content', () => {
      const htmlNodeDef: ComfyNodeDefV2 = {
        ...mockNodeDef,
        description: 'Content with **bold** text'
      }

      renderComponent(htmlNodeDef)
      const description = screen.getByTestId('node-description')

      expect(description.innerHTML).toContain('<strong>bold</strong>')
      expect(description.innerHTML).not.toContain('&lt;strong&gt;')
    })

    it('prevents XSS attacks by sanitizing dangerous HTML elements', () => {
      const maliciousNodeDef: ComfyNodeDefV2 = {
        ...mockNodeDef,
        description:
          'Normal text <img src="x" onerror="alert(\'XSS\')" /> and **bold** text'
      }

      renderComponent(maliciousNodeDef)
      const description = screen.queryByTestId('node-description')

      if (description) {
        expect(description.innerHTML).not.toContain('onerror')
        expect(description.innerHTML).not.toContain('alert(')
        expect(description.innerHTML).toContain('<strong>bold</strong>')
      }
    })
  })
})
