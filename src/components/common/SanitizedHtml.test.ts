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
})
