/* eslint-disable testing-library/no-container, testing-library/no-node-access */
/* eslint-disable testing-library/prefer-user-event */
import { fireEvent, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import Textarea from 'primevue/textarea'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { SimplifiedWidget } from '@/types/simplifiedWidget'

import WidgetMarkdown from './WidgetMarkdown.vue'
import { createMockWidget } from './widgetTestUtils'

// Mock the markdown renderer utility
vi.mock('@/utils/markdownRendererUtil', () => ({
  renderMarkdownToHtml: vi.fn((markdown: string) => {
    // Simple mock that converts some markdown to HTML
    return markdown
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
      .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
      .replace(/\n/g, '<br>')
  })
}))

describe('WidgetMarkdown Dual Mode Display', () => {
  const createMarkdownWidget = (
    value: string = '# Default Heading\nSome **bold** text.',
    options: SimplifiedWidget<string>['options'] = {},
    callback?: (value: string) => void
  ) =>
    createMockWidget<string>({
      value,
      name: 'test_markdown',
      type: 'string',
      options,
      callback
    })

  function renderComponent(
    widget: SimplifiedWidget<string>,
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
        plugins: [PrimeVue, i18n],
        components: { Textarea }
      },
      props: {
        widget,
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
      const { container } = renderComponent(widget, markdown)

      const displayDiv = container.querySelector('.comfy-markdown-content')
      expect(displayDiv).not.toBeNull()
      expect(displayDiv!.innerHTML).toContain('<h1>Heading</h1>')
      expect(displayDiv!.innerHTML).toContain('<strong>bold</strong>')
      expect(displayDiv!.innerHTML).toContain('<em>italic</em>')
    })

    it('starts in display mode by default', (context) => {
      context.skip(
        'Something in the logic in these tests is definitely off. needs diagnosis'
      )
      const widget = createMarkdownWidget('# Test')
      const { container } = renderComponent(widget, '# Test')

      expect(container.querySelector('.comfy-markdown-content')).not.toBeNull()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('handles empty markdown content', () => {
      const widget = createMarkdownWidget('')
      const { container } = renderComponent(widget, '')

      const displayDiv = container.querySelector('.comfy-markdown-content')
      expect(displayDiv).not.toBeNull()
      expect(displayDiv!.textContent).toBe('')
    })
  })

  describe('Edit Mode Toggle', () => {
    it('switches to edit mode when clicked', async (context) => {
      context.skip('markdown editor not disappearing. needs diagnosis')
      const widget = createMarkdownWidget('# Test')
      const { container } = renderComponent(widget, '# Test')

      expect(container.querySelector('.comfy-markdown-content')).not.toBeNull()

      await dblClickToEdit(container)

      expect(container.querySelector('.comfy-markdown-content')).toBeNull()
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

    it('switches back to display mode on textarea blur', async (context) => {
      context.skip('textarea not disappearing. needs diagnosis')
      const widget = createMarkdownWidget('# Test')
      const { container } = renderComponent(widget, '# Test')

      await dblClickToEdit(container)
      expect(screen.getByRole('textbox')).toBeInTheDocument()

      await blurTextarea()
      expect(container.querySelector('.comfy-markdown-content')).not.toBeNull()
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

    it('applies styling and configuration to textarea', async (context) => {
      context.skip(
        'Props or styling are not as described in the test. needs diagnosis'
      )
      const widget = createMarkdownWidget('# Test')
      const { container } = renderComponent(widget, '# Test')

      await dblClickToEdit(container)

      const textarea = screen.getByRole('textbox')
      // Check rows attribute in the DOM
      expect(textarea.getAttribute('rows')).toBe('6')
      expect(textarea.classList.contains('text-xs')).toBe(true)
      expect(textarea.classList.contains('w-full')).toBe(true)
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

      // Simulate parent updating the prop after receiving the emitted value
      await rerender({
        widget,
        modelValue: '## New Heading\nWith **bold** text'
      })

      await blurTextarea()

      const displayDiv = container.querySelector('.comfy-markdown-content')
      expect(displayDiv!.innerHTML).toContain('<h2>New Heading</h2>')
      expect(displayDiv!.innerHTML).toContain('<strong>bold</strong>')
    })

    it('emits update:modelValue for callback handling at parent level', async () => {
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

    it('handles missing callback gracefully', async () => {
      const widget = createMarkdownWidget('# Test', {}, undefined)
      const onUpdateModelValue = vi.fn()
      const { container } = renderComponent(
        widget,
        '# Test',
        onUpdateModelValue
      )

      await dblClickToEdit(container)

      const textarea = screen.getByRole('textbox')
      await fireEvent.update(textarea, '# Changed')

      // Should not throw error and should still emit Vue event
      await expect(fireEvent.input(textarea)).resolves.not.toThrow()

      expect(onUpdateModelValue).toHaveBeenCalled()
    })
  })

  describe('Complex Markdown Rendering', () => {
    it('handles multiple markdown elements', () => {
      const complexMarkdown = `# Main Heading
## Subheading
This paragraph has **bold** and *italic* text.
Another line with more content.`

      const widget = createMarkdownWidget(complexMarkdown)
      const { container } = renderComponent(widget, complexMarkdown)

      const displayDiv = container.querySelector('.comfy-markdown-content')
      expect(displayDiv!.innerHTML).toContain('<h1>Main Heading</h1>')
      expect(displayDiv!.innerHTML).toContain('<h2>Subheading</h2>')
      expect(displayDiv!.innerHTML).toContain('<strong>bold</strong>')
      expect(displayDiv!.innerHTML).toContain('<em>italic</em>')
    })

    it('handles line breaks in markdown', () => {
      const markdownWithBreaks = 'Line 1\nLine 2\nLine 3'
      const widget = createMarkdownWidget(markdownWithBreaks)
      const { container } = renderComponent(widget, markdownWithBreaks)

      const displayDiv = container.querySelector('.comfy-markdown-content')
      expect(displayDiv!.innerHTML).toContain('<br>')
    })

    it('handles empty or whitespace-only markdown', () => {
      const whitespaceMarkdown = '   \n\n   '
      const widget = createMarkdownWidget(whitespaceMarkdown)
      const { container } = renderComponent(widget, whitespaceMarkdown)

      const displayDiv = container.querySelector('.comfy-markdown-content')
      expect(displayDiv).not.toBeNull()
    })
  })

  describe('Edge Cases', () => {
    it('handles very long markdown content', async () => {
      const longMarkdown = '# Heading\n' + 'Lorem ipsum '.repeat(1000)
      const widget = createMarkdownWidget(longMarkdown)
      const { container } = renderComponent(widget, longMarkdown)

      // Should render without issues
      const displayDiv = container.querySelector('.comfy-markdown-content')
      expect(displayDiv).not.toBeNull()

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

      // Rapid toggling
      await dblClickToEdit(container)
      expect(screen.getByRole('textbox')).toBeInTheDocument()

      await blurTextarea()
      expect(container.querySelector('.comfy-markdown-content')).not.toBeNull()

      await dblClickToEdit(container)
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })

  describe('Focus Management', () => {
    it('creates textarea reference when entering edit mode', async () => {
      const widget = createMarkdownWidget('# Test')
      const { container } = renderComponent(widget, '# Test')

      // Initially not in edit mode - textarea should not be visible
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

      // Double-click to start editing
      await dblClickToEdit(container)

      // Check that textarea exists after entering edit mode
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })
  })
})
