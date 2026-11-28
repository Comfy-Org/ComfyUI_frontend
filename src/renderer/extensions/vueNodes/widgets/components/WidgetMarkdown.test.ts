/* oxlint-disable testing-library/no-container, testing-library/no-node-access */
/* oxlint-disable testing-library/prefer-user-event */
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import type { IWidgetOptions } from '@comfyorg/graph-model/widgets'

import WidgetMarkdown from './WidgetMarkdown.vue'
import { registerTestWidget } from './widgetTestUtils'

// Mock the markdown renderer utility
vi.mock(import('@/utils/markdownRendererUtil'), () => ({
  renderMarkdownToHtml: vi.fn((markdown: string) => {
    // Simple mock that converts some markdown to HTML
    return markdown
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^# (.*)$/gm, '<h1>$1</h1>')
      .replace(/^## (.*)$/gm, '<h2>$1</h2>')
      .replace(/\n/g, '<br>')
  })
}))

describe('WidgetMarkdown Dual Mode Display', () => {
  const createMarkdownWidget = (
    value: string = '# Default Heading\nSome **bold** text.',
    options: IWidgetOptions = {}
  ) =>
    registerTestWidget({
      value,
      name: 'test_markdown',
      type: 'string',
      options
    })

  function renderComponent(
    widgetId: WidgetId,
    modelValue: string,
    onUpdateModelValue?: (...args: unknown[]) => void
  ) {
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: {
          ...enMessages
        }
      }
    })

    return render(WidgetMarkdown, {
      global: {
        plugins: [i18n]
      },
      props: {
        widgetId,
        modelValue,
        ...(onUpdateModelValue
          ? { 'onUpdate:modelValue': onUpdateModelValue }
          : {})
      }
    })
  }

  async function dblClickToEdit(container: Element) {
    const widgetMarkdown = container.querySelector(
      '.widget-markdown'
    ) as HTMLElement
    await userEvent.dblClick(widgetMarkdown)
    await nextTick()
    return widgetMarkdown
  }

  async function blurTextarea() {
    const textarea = screen.queryByRole('textbox')
    if (textarea) {
      await fireEvent.blur(textarea)
      await nextTick()
    }
    return textarea
  }

  describe('Display Mode', () => {
    it('renders markdown content as HTML in display mode', () => {
      const markdown = '# Heading\nSome **bold** and *italic* text.'
      const widget = createMarkdownWidget(markdown)
      renderComponent(widget, markdown)

      const displayDiv = screen.getByRole('region', { name: 'test_markdown' })
      expect(displayDiv).toBeInTheDocument()
      expect(displayDiv.innerHTML).toContain('<h1>Heading</h1>')
      expect(displayDiv.innerHTML).toContain('<strong>bold</strong>')
      expect(displayDiv.innerHTML).toContain('<em>italic</em>')
    })

    it('handles empty markdown content', () => {
      const widget = createMarkdownWidget('')
      renderComponent(widget, '')

      const displayDiv = screen.getByRole('region', { name: 'test_markdown' })
      expect(displayDiv).toBeInTheDocument()
      expect(displayDiv.textContent).toBe('')
    })
  })

  describe('Edit Mode Toggle', () => {
    it('switches to edit mode when clicked', async () => {
      const widget = createMarkdownWidget('# Test')
      const { container } = renderComponent(widget, '# Test')

      const displayContent = screen.getByRole('region', {
        name: 'test_markdown'
      })
      expect(displayContent).toHaveClass('visible')
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

      await dblClickToEdit(container)

      expect(displayContent).toHaveClass('invisible')
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('does not switch to edit mode when already editing', async () => {
      const widget = createMarkdownWidget('# Test')
      const { container } = renderComponent(widget, '# Test')

      // First click to enter edit mode
      await dblClickToEdit(container)
      expect(screen.getByRole('textbox')).toBeInTheDocument()

      // Second click should not have any effect
      await dblClickToEdit(container)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    it('switches back to display mode on textarea blur', async () => {
      const widget = createMarkdownWidget('# Test')
      const { container } = renderComponent(widget, '# Test')

      const displayContent = screen.getByRole('region', {
        name: 'test_markdown'
      })

      await dblClickToEdit(container)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(displayContent).toHaveClass('invisible')

      await blurTextarea()
      expect(displayContent).toHaveClass('visible')
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
  })

  describe('Edit Mode', () => {
    it('displays textarea with current value when editing', async () => {
      const markdown = '# Original Content'
      const widget = createMarkdownWidget(markdown)
      const { container } = renderComponent(widget, markdown)

      await dblClickToEdit(container)

      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toBe('# Original Content')
    })

    it('stops click and keydown event propagation in edit mode', async () => {
      const widget = createMarkdownWidget('# Test')
      const { container } = renderComponent(widget, '# Test')

      await dblClickToEdit(container)

      const textarea = screen.getByRole('textbox')
      const clickSpy = vi.fn()
      const keydownSpy = vi.fn()

      const rootEl = container.firstElementChild as HTMLElement
      rootEl.addEventListener('click', clickSpy)
      rootEl.addEventListener('keydown', keydownSpy)

      await fireEvent.click(textarea)
      await fireEvent.keyDown(textarea, { key: 'Enter' })

      // Events should be stopped from propagating
      expect(clickSpy).not.toHaveBeenCalled()
      expect(keydownSpy).not.toHaveBeenCalled()
    })

    describe('Pointer Event Propagation', () => {
      it('stops pointerdown propagation to prevent node drag during text selection', async () => {
        const widget = createMarkdownWidget('# Test')
        const { container } = renderComponent(widget, '# Test')

        await dblClickToEdit(container)

        const textarea = screen.getByRole('textbox')

        const parentPointerdownHandler = vi.fn()
        const rootEl = container.firstElementChild as HTMLElement
        rootEl.addEventListener('pointerdown', parentPointerdownHandler)

        await fireEvent.pointerDown(textarea)

        expect(parentPointerdownHandler).not.toHaveBeenCalled()
      })

      it('stops pointermove propagation during text selection', async () => {
        const widget = createMarkdownWidget('# Test')
        const { container } = renderComponent(widget, '# Test')

        await dblClickToEdit(container)

        const textarea = screen.getByRole('textbox')

        const parentPointermoveHandler = vi.fn()
        const rootEl = container.firstElementChild as HTMLElement
        rootEl.addEventListener('pointermove', parentPointermoveHandler)

        await fireEvent.pointerMove(textarea)

        expect(parentPointermoveHandler).not.toHaveBeenCalled()
      })

      it('stops pointerup propagation after text selection', async () => {
        const widget = createMarkdownWidget('# Test')
        const { container } = renderComponent(widget, '# Test')

        await dblClickToEdit(container)

        const textarea = screen.getByRole('textbox')

        const parentPointerupHandler = vi.fn()
        const rootEl = container.firstElementChild as HTMLElement
        rootEl.addEventListener('pointerup', parentPointerupHandler)

        await fireEvent.pointerUp(textarea)

        expect(parentPointerupHandler).not.toHaveBeenCalled()
      })
    })
  })

  describe('Value Updates', () => {
    it('emits update:modelValue when textarea content changes', async () => {
      const widget = createMarkdownWidget('# Original')
      const onUpdateModelValue = vi.fn()
      const { container } = renderComponent(
        widget,
        '# Original',
        onUpdateModelValue
      )

      await dblClickToEdit(container)

      const textarea = screen.getByRole('textbox')
      await fireEvent.update(textarea, '# Updated Content')
      await fireEvent.input(textarea)

      expect(onUpdateModelValue).toHaveBeenCalled()
      const lastCall =
        onUpdateModelValue.mock.calls[onUpdateModelValue.mock.calls.length - 1]
      expect(lastCall).toEqual(['# Updated Content'])
    })

    it('renders updated HTML after value change and blur', async () => {
      const widget = createMarkdownWidget('# Original')
      const onUpdateModelValue = vi.fn()
      const { container, rerender } = renderComponent(
        widget,
        '# Original',
        onUpdateModelValue
      )

      await dblClickToEdit(container)

      const textarea = screen.getByRole('textbox')
      await fireEvent.update(textarea, '## New Heading\nWith **bold** text')
      await fireEvent.input(textarea)

      await rerender({
        modelValue: '## New Heading\nWith **bold** text'
      })

      await blurTextarea()

      const displayDiv = screen.getByRole('region', { name: 'test_markdown' })
      expect(displayDiv.innerHTML).toContain('<h2>New Heading</h2>')
      expect(displayDiv.innerHTML).toContain('<strong>bold</strong>')
    })

    it('emits the edited text as update:modelValue', async () => {
      const widget = createMarkdownWidget('# Test', {})
      const onUpdateModelValue = vi.fn()
      const { container } = renderComponent(
        widget,
        '# Test',
        onUpdateModelValue
      )

      await dblClickToEdit(container)

      const textarea = screen.getByRole('textbox')
      await fireEvent.update(textarea, '# Changed')
      await fireEvent.input(textarea)

      expect(onUpdateModelValue).toHaveBeenCalled()
      const lastCall =
        onUpdateModelValue.mock.calls[onUpdateModelValue.mock.calls.length - 1]
      expect(lastCall).toEqual(['# Changed'])
    })
  })

  describe('Complex Markdown Rendering', () => {
    it('handles multiple markdown elements', () => {
      const complexMarkdown = `# Main Heading
## Subheading
This paragraph has **bold** and *italic* text.
Another line with more content.`

      const widget = createMarkdownWidget(complexMarkdown)
      renderComponent(widget, complexMarkdown)

      const displayDiv = screen.getByRole('region', { name: 'test_markdown' })
      expect(displayDiv.innerHTML).toContain('<h1>Main Heading</h1>')
      expect(displayDiv.innerHTML).toContain('<h2>Subheading</h2>')
      expect(displayDiv.innerHTML).toContain('<strong>bold</strong>')
      expect(displayDiv.innerHTML).toContain('<em>italic</em>')
    })

    it('handles empty or whitespace-only markdown', () => {
      const whitespaceMarkdown = '   \n\n   '
      const widget = createMarkdownWidget(whitespaceMarkdown)
      renderComponent(widget, whitespaceMarkdown)

      const displayDiv = screen.getByRole('region', { name: 'test_markdown' })
      expect(displayDiv).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles very long markdown content', async () => {
      const longMarkdown = '# Heading\n' + 'Lorem ipsum '.repeat(1000)
      const widget = createMarkdownWidget(longMarkdown)
      const { container } = renderComponent(widget, longMarkdown)

      // Should render without issues
      const displayDiv = screen.getByRole('region', { name: 'test_markdown' })
      expect(displayDiv).toBeInTheDocument()

      // Should switch to edit mode
      await dblClickToEdit(container)
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toBe(longMarkdown)
    })

    it('handles special characters in markdown', async () => {
      const specialChars = '# Special: @#$%^&*()[]{}|\\:";\'<>?,./'
      const widget = createMarkdownWidget(specialChars)
      const { container } = renderComponent(widget, specialChars)

      await dblClickToEdit(container)
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toBe(specialChars)
    })

    it('handles unicode characters', async () => {
      const unicode = '# Unicode: 🎨 αβγ 中文 العربية 🚀'
      const widget = createMarkdownWidget(unicode)
      const onUpdateModelValue = vi.fn()
      const { container } = renderComponent(widget, unicode, onUpdateModelValue)

      await dblClickToEdit(container)
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(textarea.value).toBe(unicode)

      await fireEvent.update(textarea, unicode + ' more unicode')
      await fireEvent.input(textarea)

      expect(onUpdateModelValue).toHaveBeenCalled()
      const lastCall =
        onUpdateModelValue.mock.calls[onUpdateModelValue.mock.calls.length - 1]
      expect(lastCall).toEqual([unicode + ' more unicode'])
    })

    it('handles rapid edit mode toggling', async () => {
      const widget = createMarkdownWidget('# Test')
      const { container } = renderComponent(widget, '# Test')

      await dblClickToEdit(container)
      expect(screen.getByRole('textbox')).toBeInTheDocument()

      await blurTextarea()
      expect(screen.getByRole('region', { name: 'test_markdown' })).toHaveClass(
        'visible'
      )
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

      await dblClickToEdit(container)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  describe('Focus Management', () => {
    it('focuses the textarea when entering edit mode', async () => {
      const widget = createMarkdownWidget('# Test')
      const { container } = renderComponent(widget, '# Test')

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

      await dblClickToEdit(container)

      expect(screen.getByRole('textbox')).toHaveFocus()
    })
  })
})
